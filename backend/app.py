from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    jwt_required,
    create_access_token,
    get_jwt_identity,
    decode_token,
)
from functools import wraps
from datetime import timedelta, datetime, timezone
import os
import json
import uuid
import re
from dotenv import load_dotenv
import requests
from postgrest.exceptions import APIError as PostgrestAPIError
from supabase_client import supabase, supabase_admin
from image_utils import (
    allowed_file,
    normalize_image_url,
    upload_product_image,
    upload_avatar,
    storage_path_from_url,
    PRODUCT_IMAGES_BUCKET,
    MAX_AVATAR_BYTES,
    SHOP_UPLOAD_FOLDER,
)
from notifications import create_notification
from notification_utils import (
    normalize_notification,
    is_allowed_notification_type,
    notification_reference_data,
)
from message_utils import (
    insert_message,
    normalize_message,
    message_text,
    update_conversation_after_message,
    mark_messages_read,
    count_unread_messages,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

app = Flask(__name__)
jwt_secret = os.environ.get('JWT_SECRET_KEY')
if not jwt_secret:
    print("[AUTH WARNING] JWT_SECRET_KEY is missing — Flask JWT validation will fail")
app.config['JWT_SECRET_KEY'] = jwt_secret
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

jwt = JWTManager(app)

CORS(
    app,
    origins=["http://localhost:5173", "http://localhost:3000"],
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
print("SUPABASE_URL:", SUPABASE_URL)


# ---------------- AUTH HELPERS ----------------
def _mask_token(token):
    if not token:
        return None
    token = str(token)
    if len(token) <= 12:
        return '***'
    return f"{token[:6]}...{token[-4:]}"


def _parse_bearer_token():
    auth_header = request.headers.get('Authorization')
    print(f"[AUTH DEBUG] {request.method} {request.path}")
    print(f"[AUTH DEBUG] Authorization header present: {bool(auth_header)}")

    if not auth_header:
        print("[AUTH DEBUG] FAIL: No Authorization header")
        return None, 'missing_authorization_header'

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        print(f"[AUTH DEBUG] FAIL: Malformed header (expected 'Bearer <token>'), got: {auth_header[:40]}...")
        return None, 'malformed_authorization_header'

    token = parts[1].strip()
    if not token or token in ('null', 'undefined'):
        print("[AUTH DEBUG] FAIL: Empty or invalid token value")
        return None, 'empty_token'

    print(f"[AUTH DEBUG] Bearer token received: {_mask_token(token)}")
    return token, None


def _verify_flask_jwt(token):
    try:
        decoded = decode_token(token)
        user_id = decoded.get('sub')
        if user_id:
            print(f"[AUTH DEBUG] Flask JWT valid for user_id={user_id}")
            return str(user_id)
        print("[AUTH DEBUG] Flask JWT decoded but missing 'sub' claim")
    except Exception as e:
        print(f"[AUTH DEBUG] Flask JWT invalid: {type(e).__name__}: {e}")
    return None


def _verify_supabase_access_token(access_token):
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': f'Bearer {access_token}',
            },
            timeout=10,
        )
        if resp.status_code == 200:
            user_id = resp.json().get('id')
            if user_id:
                print(f"[AUTH DEBUG] Supabase access token valid for user_id={user_id}")
                return str(user_id)
        print(f"[AUTH DEBUG] Supabase token rejected: status={resp.status_code} body={resp.text[:200]}")
    except Exception as e:
        print(f"[AUTH DEBUG] Supabase token verification error: {type(e).__name__}: {e}")
    return None


def resolve_authenticated_user_id():
    token, error = _parse_bearer_token()
    if error:
        return None, error

    user_id = _verify_flask_jwt(token)
    if user_id:
        return user_id, 'flask_jwt'

    user_id = _verify_supabase_access_token(token)
    if user_id:
        return user_id, 'supabase_access_token'

    print("[AUTH DEBUG] FAIL: Token is neither a valid Flask JWT nor Supabase access token")
    return None, 'invalid_token'


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id, reason = resolve_authenticated_user_id()
        if not user_id:
            return jsonify({
                'error': 'Unauthorized',
                'reason': reason,
                'hint': 'Login again and send Authorization: Bearer <token>',
            }), 401
        g.user_id = user_id
        print(f"[AUTH DEBUG] Authenticated user_id={user_id} via {reason}")
        return fn(*args, **kwargs)
    return wrapper


@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print(f"[AUTH DEBUG] @jwt_required FAIL: expired token, sub={jwt_payload.get('sub')}")
    return jsonify({'error': 'Token expired', 'reason': 'expired_token'}), 401


@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"[AUTH DEBUG] @jwt_required FAIL: invalid token — {error}")
    return jsonify({'error': 'Invalid token', 'reason': 'invalid_token', 'detail': str(error)}), 401


@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"[AUTH DEBUG] @jwt_required FAIL: missing token — {error}")
    return jsonify({'error': 'Missing Authorization header', 'reason': 'missing_token'}), 401

UPLOAD_FOLDER = SHOP_UPLOAD_FOLDER


def get_shop_owner(shop_id):
    res = supabase.table("shops").select("owner_id").eq("id", shop_id).execute()
    if not res.data:
        return None
    return str(res.data[0]["owner_id"])


def _log_supabase(operation, response):
    """Log Supabase PostgREST responses; surface errors instead of failing silently."""
    row_count = len(response.data) if response.data is not None else 0
    print(f"[SUPABASE] {operation} — rows={row_count}, data={response.data}")

    if getattr(response, "error", None):
        err = response.error
        message = getattr(err, "message", None) or str(err)
        print(f"[SUPABASE] {operation} ERROR: {message}")
        raise Exception(f"{operation} failed: {message}")

    return response


def _format_postgrest_error(err: Exception) -> str:
    """Return a readable message from a PostgREST APIError (do not hide details)."""
    if isinstance(err, PostgrestAPIError):
        parts = [err.message, err.details, err.hint]
        return " — ".join(p for p in parts if p) or str(err)
    return str(err)


_normalize_image_url = normalize_image_url


def _save_shop_image_file(shop_id, image, caption=""):
    ext = image.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    image.save(filepath)
    print(f"[SHOP_IMAGE] Saved upload for shop_id={shop_id} -> {filepath}")
    return f"/uploads/shops/{filename}", caption or "Shop image"


def _upsert_main_shop_image(shop_id, image_url, caption=""):
    """
    Upsert the main shop image in shop_images (NOT the shops table).
    Flask JWT + service-role bypass RLS; ownership is checked in the route.
    """
    image_url = _normalize_image_url(image_url)
    if not image_url:
        raise Exception("image_url is required for shop_images upsert")

    payload = {
        "image_url": image_url,
        "caption": caption or "Shop image",
    }

    print(f"[SHOP_IMAGE] upsert shop_id={shop_id}, image_url={image_url}")

    existing = _log_supabase(
        "shop_images select",
        supabase_admin.table("shop_images")
        .select("id, shop_id, image_url")
        .eq("shop_id", shop_id)
        .order("id", desc=False)
        .limit(1)
        .execute(),
    )

    if existing.data:
        row_id = existing.data[0]["id"]
        print(f"[SHOP_IMAGE] UPDATE path — row_id={row_id}")
        _log_supabase(
            "shop_images update",
            supabase_admin.table("shop_images")
            .update(payload)
            .eq("id", row_id)
            .execute(),
        )
        fetched = _log_supabase(
            "shop_images select after update",
            supabase_admin.table("shop_images")
            .select("id, shop_id, image_url, caption")
            .eq("id", row_id)
            .execute(),
        )
        if not fetched.data:
            raise Exception("shop_images update succeeded but row not found")
        return fetched.data[0]

    print(f"[SHOP_IMAGE] INSERT path — no row for shop_id={shop_id}")
    insert_payload = {"shop_id": shop_id, **payload}
    _log_supabase(
        "shop_images insert",
        supabase_admin.table("shop_images")
        .insert(insert_payload)
        .execute(),
    )
    fetched = _log_supabase(
        "shop_images select after insert",
        supabase_admin.table("shop_images")
        .select("id, shop_id, image_url, caption")
        .eq("shop_id", shop_id)
        .order("id", desc=True)
        .limit(1)
        .execute(),
    )
    if not fetched.data:
        raise Exception("shop_images insert succeeded but row not found")
    return fetched.data[0]


def _fetch_shop_with_relations(shop_id):
    shop_res = supabase.table("shops") \
        .select("*, profiles ( name, profile_image )") \
        .eq("id", shop_id) \
        .execute()

    if not shop_res.data:
        return None

    shop = shop_res.data[0]
    images_res = supabase.table("shop_images") \
        .select("*") \
        .eq("shop_id", shop_id) \
        .execute()
    shop["shop_images"] = images_res.data or []
    return shop


# ---------------- AUTH ----------------
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()

        email = data.get('email')
        password = data.get('password')
        name = data.get('name') or (email.split('@')[0] if email else None)

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        # 1. Create user in Supabase Auth
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers={
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'email': email,
                'password': password,
                'data': {'name': name}
            }
        )

        result = response.json()

        # 2. Handle auth errors
        if response.status_code not in [200, 201]:
            print("AUTH ERROR:", result)

            # user already exists case
            if result.get("error_code") == "user_already_exists":
                return jsonify({'error': 'User already exists. Please login.'}), 400

            return jsonify({'error': result}), 400

        user = result.get('user')
        if not user:
            return jsonify({'error': 'User creation failed'}), 500

        user_id = user.get('id')

        # 3. Check if profile already exists (IMPORTANT)
        existing_profile = supabase.table("profiles") \
            .select("*") \
            .eq("id", user_id) \
            .execute()

        if not existing_profile.data:
            profile_response = supabase.table("profiles").insert({
                'id': user_id,
                'name': name,
                'email': email,
                'skills': [],
                'has_shop': False,
                'bio': ''
            }).execute()

            print("PROFILE RESPONSE:", profile_response)

            if profile_response.error:
                return jsonify({
                    'error': profile_response.error.message
                }), 400

        # 4. Create JWT token (identity must be string for flask-jwt-extended)
        token = create_access_token(identity=str(user_id))
        supabase_access_token = result.get('access_token') or result.get('session', {}).get('access_token')

        return jsonify({
            'token': token,
            'access_token': supabase_access_token,
            'user_id': user_id,
        }), 201

    except Exception as e:
        print("REGISTER ERROR:", e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()

        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={'apikey': SUPABASE_ANON_KEY},
            json={'email': email, 'password': password}
        )

        if response.status_code != 200:
            return jsonify({'error': 'Invalid credentials'}), 401

        result = response.json()

        user_id = result['user']['id']
        token = create_access_token(identity=str(user_id))
        supabase_access_token = result.get('access_token')

        profile_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        profile = profile_res.data[0] if profile_res.data else None

        print(f"[AUTH DEBUG] Login issued Flask JWT for user_id={user_id}, supabase_token={'yes' if supabase_access_token else 'no'}")

        return jsonify({
            'token': token,
            'access_token': supabase_access_token,
            'refresh_token': result.get('refresh_token'),
            'user_id': user_id,
            'user': profile,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------- PROFILE ----------------
@app.route('/api/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        user_id = get_jwt_identity()

        res = supabase.table("profiles").select("*").eq("id", user_id).execute()

        if not res.data:
            return jsonify({'error': 'Profile not found'}), 404

        return jsonify(res.data[0])

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        update_data = {
            'name': data.get('name'),
            'bio': data.get('bio'),
            'skills': data.get('skills', [])
        }

        update_data = {k: v for k, v in update_data.items() if v is not None}

        supabase.table("profiles").update(update_data).eq("id", user_id).execute()

        return jsonify({'message': 'Profile updated'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------- UPLOADS ----------------
@app.route('/uploads/shops/<path:filename>')
def serve_shop_image(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ---------------- SHOPS ----------------
@app.route("/api/shops", methods=["POST"])
@jwt_required()
def create_shop():
    try:
        user_id = get_jwt_identity()

        existing_shop = supabase.table("shops") \
            .select("*") \
            .eq("owner_id", user_id) \
            .execute()

        if existing_shop.data and len(existing_shop.data) > 0:
            return jsonify({"error": "Shop already exists"}), 409

        title = request.form.get("title") or (request.get_json(silent=True) or {}).get("title")
        description = request.form.get("description") or (request.get_json(silent=True) or {}).get("description", "")
        phone = request.form.get("phone") or (request.get_json(silent=True) or {}).get("phone", "")

        tags_raw = request.form.get("tags")
        if tags_raw:
            tags = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
        else:
            json_data = request.get_json(silent=True) or {}
            tags = json_data.get("tags", [])

        if not title:
            return jsonify({"error": "Title required"}), 400

        shop_row = {
            "title": title,
            "description": description,
            "tags": tags,
            "phone": phone,
            "owner_id": user_id,
            "category": "",
        }
        res = supabase.table("shops").insert(shop_row).execute()

        if not res.data:
            return jsonify({"error": "Failed to create shop"}), 500

        shop = res.data[0]
        shop_id = shop["id"]

        image = request.files.get("image")
        if image and image.filename and allowed_file(image.filename):
            ext = image.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            image.save(filepath)

            image_url = f"/uploads/shops/{filename}"
            _upsert_main_shop_image(shop_id, image_url, title)

        supabase.table("profiles").update({
            "has_shop": True
        }).eq("id", user_id).execute()

        images_res = supabase.table("shop_images").select("*").eq("shop_id", shop_id).execute()
        shop["shop_images"] = images_res.data or []

        return jsonify(shop), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/shops/<shop_id>", methods=["GET"])
def get_shop(shop_id):
    try:
        shop = _fetch_shop_with_relations(shop_id)
        if not shop:
            return jsonify({"error": "Shop not found"}), 404
        return jsonify(shop)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _apply_shop_update(shop_id):
    """Shared update logic for PATCH and POST (multipart)."""
    user_id = g.user_id
    owner_id = get_shop_owner(shop_id)

    if not owner_id:
        return jsonify({"error": "Shop not found"}), 404

    if owner_id != user_id:
        return jsonify({"error": "Only the shop owner can update this shop"}), 403

    # Debug incoming payload (multipart or JSON)
    print(f"[UPDATE_SHOP] shop_id={shop_id}, user_id={user_id}")
    print(f"[UPDATE_SHOP] form keys={list(request.form.keys())}")
    print(f"[UPDATE_SHOP] files={list(request.files.keys())}")
    if request.form.get("tags") is not None:
        print(f"[UPDATE_SHOP] tags raw={request.form.get('tags')[:200]}")
    if request.form.get("image_url"):
        print(f"[UPDATE_SHOP] image_url={request.form.get('image_url')}")

    shop_row = _log_supabase(
        "shops select title",
        supabase_admin.table("shops").select("title").eq("id", shop_id).execute(),
    )
    shop_title = shop_row.data[0]["title"] if shop_row.data else "Shop"

    updated_image = None

    tags_raw = request.form.get("tags")
    if tags_raw is None and request.is_json:
        json_body = request.get_json(silent=True) or {}
        tags_raw = json_body.get("tags")
        if isinstance(tags_raw, list):
            tags_raw = json.dumps(tags_raw)

    if tags_raw is not None:
        tags = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
        if not isinstance(tags, list):
            return jsonify({"error": "tags must be a JSON array"}), 400
        _log_supabase(
            "shops update tags",
            supabase_admin.table("shops").update({"tags": tags}).eq("id", shop_id).execute(),
        )

    image = request.files.get("image")
    image_url_input = (request.form.get("image_url") or "").strip()
    if not image_url_input and request.is_json:
        image_url_input = (request.get_json(silent=True) or {}).get("image_url", "").strip()

    if image and image.filename:
        if not allowed_file(image.filename):
            return jsonify({"error": "Invalid image type. Allowed: png, jpg, jpeg, gif, webp"}), 400
        local_url, caption = _save_shop_image_file(shop_id, image, shop_title)
        updated_image = _upsert_main_shop_image(shop_id, local_url, caption)
    elif image_url_input:
        updated_image = _upsert_main_shop_image(shop_id, image_url_input, shop_title)

    shop = _fetch_shop_with_relations(shop_id)
    if not shop:
        return jsonify({"error": "Shop not found"}), 404

    return jsonify({
        "message": "Shop updated successfully",
        "shop": shop,
        "shop_image": updated_image,
    }), 200


@app.route("/api/shops/<shop_id>", methods=["PATCH"])
@require_auth
def update_shop(shop_id):
    try:
        return _apply_shop_update(shop_id)
    except Exception as e:
        print(f"[UPDATE_SHOP] PATCH failed: {type(e).__name__}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/shops/<shop_id>/update", methods=["POST"])
@require_auth
def update_shop_multipart(shop_id):
    """
    POST endpoint for multipart shop updates (image file + tags).
    Some clients fail to send FormData bodies on PATCH; use this route from the frontend.
    """
    try:
        return _apply_shop_update(shop_id)
    except Exception as e:
        print(f"[UPDATE_SHOP] POST /update failed: {type(e).__name__}: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------- PRODUCTS ----------------
@app.route("/api/shops/<shop_id>/products", methods=["GET"])
def get_products(shop_id):
    try:
        res = supabase.table("products") \
            .select("*") \
            .eq("shop_id", shop_id) \
            .order("created_at", desc=True) \
            .execute()

        products = _attach_product_images(res.data or [])
        return jsonify(products)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/shops/<shop_id>/products", methods=["POST"])
@require_auth
def create_product(shop_id):
    try:
        user_id = g.user_id
        print(f"[AUTH DEBUG] create_product: shop_id={shop_id}, authenticated user_id={user_id}")

        owner_id = get_shop_owner(shop_id)

        if not owner_id:
            print(f"[AUTH DEBUG] create_product FAIL: shop not found for id={shop_id}")
            return jsonify({"error": "Shop not found"}), 404

        if owner_id != user_id:
            print(f"[AUTH DEBUG] create_product FAIL: owner_id={owner_id} != user_id={user_id}")
            return jsonify({"error": "Only the shop owner can add products"}), 403

        if request.content_type and "multipart/form-data" in request.content_type:
            data = request.form
            files = request.files.getlist("images") or []
        else:
            data = request.get_json(silent=True) or {}
            files = []

        title = data.get("title")
        if not title:
            return jsonify({"error": "Title is required"}), 400

        print(f"[AUTH DEBUG] create_product: inserting product into Supabase for shop_id={shop_id}")
        res = supabase_admin.table("products").insert({
            "shop_id": shop_id,
            "title": title,
            "description": data.get("description", ""),
            "price_or_range": data.get("price_or_range", ""),
        }).execute()

        if not res.data:
            return jsonify({"error": "Failed to create product"}), 500

        product = res.data[0]
        product_id = product["id"]

        for idx, f in enumerate(files):
            if f and f.filename and allowed_file(f.filename):
                _, public_url = upload_product_image(supabase_admin, product_id, f)
                supabase_admin.table("product_images").insert({
                    "product_id": product_id,
                    "image_url": public_url,
                    "sort_order": idx,
                    "is_primary": idx == 0,
                }).execute()

        product = _get_product_with_images(product_id)
        return jsonify(product), 201

    except Exception as e:
        print(f"[AUTH DEBUG] create_product EXCEPTION: {type(e).__name__}: {e}")
        return jsonify({"error": str(e)}), 500


def _attach_product_images(products):
    if not products:
        return products
    ids = [p["id"] for p in products]
    img_res = (
        supabase_admin.table("product_images")
        .select("*")
        .in_("product_id", ids)
        .order("sort_order", desc=False)
        .execute()
    )
    by_product = {}
    for img in img_res.data or []:
        by_product.setdefault(img["product_id"], []).append(img)
    for p in products:
        p["product_images"] = by_product.get(p["id"], [])
    return products


def _get_product_with_images(product_id):
    res = supabase_admin.table("products").select("*").eq("id", product_id).execute()
    if not res.data:
        return None
    product = res.data[0]
    imgs = (
        supabase_admin.table("product_images")
        .select("*")
        .eq("product_id", product_id)
        .order("sort_order", desc=False)
        .execute()
    )
    product["product_images"] = imgs.data or []
    shop = (
        supabase_admin.table("shops")
        .select("id, title, owner_id, profiles(name, profile_image)")
        .eq("id", product["shop_id"])
        .execute()
    )
    product["shops"] = shop.data[0] if shop.data else None
    return product


def _delete_product_storage_files(product_id):
    imgs = supabase_admin.table("product_images").select("image_url").eq("product_id", product_id).execute()
    paths = []
    for row in imgs.data or []:
        path = storage_path_from_url(row.get("image_url", ""))
        if path:
            paths.append(path)
    if paths:
        try:
            supabase_admin.storage.from_(PRODUCT_IMAGES_BUCKET).remove(paths)
        except Exception as e:
            print(f"[STORAGE] delete warning: {e}")
    supabase_admin.table("product_images").delete().eq("product_id", product_id).execute()


@app.route("/api/shops/feed", methods=["GET"])
def feed_shops():
    """Public feed — uses service role so shop_images are included (anon RLS may block nested rows)."""
    try:
        search = (request.args.get("search") or "").strip()
        sort_by = request.args.get("sort") or "newest"
        page = max(0, int(request.args.get("page", 0)))
        page_size = min(50, max(1, int(request.args.get("page_size", 9))))

        query = supabase.table("shops").select(
            "*, profiles ( id, name, profile_image )",
            count="exact",
        )

        if search:
            query = query.or_(
                f"title.ilike.%{search}%,description.ilike.%{search}%"
            )

        query = query.order("created_at", desc=True)

        start = page * page_size
        end = start + page_size - 1
        res = query.range(start, end).execute()
        shops = res.data or []
        shop_ids = [s["id"] for s in shops]

        images_by_shop = {}
        if shop_ids:
            img_res = (
                supabase.table("shop_images")
                .select("shop_id, image_url, caption, id")
                .in_("shop_id", shop_ids)
                .execute()
            )
            for img in img_res.data or []:
                images_by_shop.setdefault(img["shop_id"], []).append(img)

        for shop in shops:
            shop["shop_images"] = images_by_shop.get(shop["id"], [])

        total = res.count if res.count is not None else len(shops)
        return jsonify({
            "shops": shops,
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": (page + 1) * page_size < total,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    try:
        product = _get_product_with_images(product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404
        return jsonify(product)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/products/<product_id>", methods=["PATCH"])
@require_auth
def update_product(product_id):
    try:
        user_id = g.user_id
        product = supabase_admin.table("products").select("shop_id").eq("id", product_id).execute()
        if not product.data:
            return jsonify({"error": "Product not found"}), 404
        shop_id = product.data[0]["shop_id"]
        if get_shop_owner(shop_id) != user_id:
            return jsonify({"error": "Forbidden"}), 403

        if request.content_type and "multipart/form-data" in request.content_type:
            data = request.form
        else:
            data = request.get_json(silent=True) or {}

        update_fields = {}
        for key in ("title", "description", "price_or_range"):
            if key in data and data.get(key) is not None:
                update_fields[key] = data.get(key)

        if update_fields:
            supabase_admin.table("products").update(update_fields).eq("id", product_id).execute()

        files = request.files.getlist("images") or []
        for f in files:
            if f and f.filename and allowed_file(f.filename):
                _, public_url = upload_product_image(supabase_admin, product_id, f)
                existing = (
                    supabase_admin.table("product_images")
                    .select("id")
                    .eq("product_id", product_id)
                    .execute()
                )
                is_first = not existing.data
                supabase_admin.table("product_images").insert({
                    "product_id": product_id,
                    "image_url": public_url,
                    "sort_order": len(existing.data or []),
                    "is_primary": is_first,
                }).execute()

        updated = _get_product_with_images(product_id)
        return jsonify(updated)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/product-images/<image_id>", methods=["DELETE"])
@require_auth
def delete_product_image(image_id):
    try:
        user_id = g.user_id
        row = supabase_admin.table("product_images").select("*, products(shop_id)").eq("id", image_id).execute()
        if not row.data:
            return jsonify({"error": "Image not found"}), 404
        img = row.data[0]
        shop_id = img["products"]["shop_id"]
        if get_shop_owner(shop_id) != user_id:
            return jsonify({"error": "Forbidden"}), 403

        path = storage_path_from_url(img.get("image_url", ""))
        if path:
            try:
                supabase_admin.storage.from_(PRODUCT_IMAGES_BUCKET).remove([path])
            except Exception as e:
                print(f"[STORAGE] {e}")

        product_id = img["product_id"]
        was_primary = img.get("is_primary")
        supabase_admin.table("product_images").delete().eq("id", image_id).execute()

        if was_primary:
            remaining = (
                supabase_admin.table("product_images")
                .select("id")
                .eq("product_id", product_id)
                .order("sort_order", desc=False)
                .limit(1)
                .execute()
            )
            if remaining.data:
                supabase_admin.table("product_images").update({"is_primary": True}).eq(
                    "id", remaining.data[0]["id"]
                ).execute()

        return jsonify({"message": "Image deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/product-images/<image_id>/primary", methods=["POST"])
@require_auth
def set_primary_product_image(image_id):
    try:
        user_id = g.user_id
        row = supabase_admin.table("product_images").select("*, products(shop_id)").eq("id", image_id).execute()
        if not row.data:
            return jsonify({"error": "Image not found"}), 404
        img = row.data[0]
        product_id = img["product_id"]
        if get_shop_owner(img["products"]["shop_id"]) != user_id:
            return jsonify({"error": "Forbidden"}), 403

        supabase_admin.table("product_images").update({"is_primary": False}).eq(
            "product_id", product_id
        ).execute()
        supabase_admin.table("product_images").update({"is_primary": True}).eq("id", image_id).execute()
        return jsonify({"message": "Primary image updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/products/<product_id>", methods=["DELETE"])
@require_auth
def delete_product(product_id):
    try:
        user_id = g.user_id

        product_res = supabase_admin.table("products").select("shop_id").eq("id", product_id).execute()
        if not product_res.data:
            return jsonify({"error": "Product not found"}), 404

        shop_id = product_res.data[0]["shop_id"]
        owner_id = get_shop_owner(shop_id)

        if owner_id != user_id:
            return jsonify({"error": "Only the shop owner can delete products"}), 403

        _delete_product_storage_files(product_id)
        supabase_admin.table("products").delete().eq("id", product_id).execute()

        return jsonify({"message": "Product deleted"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- PROFILE AVATAR ----------------
@app.route("/api/profile/avatar", methods=["POST"])
@require_auth
def upload_profile_avatar():
    """
    Upload profile avatar via service role (bypasses storage RLS).
    Stores public URL in profiles.profile_image — standard format for the app.
    Object path: avatars/{user_id}/avatar.{ext}
    """
    try:
        user_id = g.user_id
        file = request.files.get("avatar") or request.files.get("image")
        if not file or not file.filename:
            return jsonify({"error": "No file provided"}), 400
        if not allowed_file(file.filename):
            return jsonify({
                "error": "Unsupported file type. Allowed: png, jpg, jpeg, gif, webp",
            }), 400

        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > MAX_AVATAR_BYTES:
            return jsonify({"error": "File too large (max 5MB)"}), 400

        public_url = upload_avatar(supabase_admin, user_id, file)
        res = supabase_admin.table("profiles").update({
            "profile_image": public_url,
        }).eq("id", user_id).execute()

        if not res.data:
            return jsonify({"error": "Failed to update profile"}), 500

        return jsonify({"profile_image": public_url, "profile": res.data[0]})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[AVATAR] upload failed: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------- PROFILES (public) ----------------
@app.route("/api/profiles/<user_id>", methods=["GET"])
def get_public_profile(user_id):
    try:
        res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        if not res.data:
            return jsonify({"error": "Profile not found"}), 404
        profile = res.data

        shops = supabase.table("shops").select("id, title, created_at").eq(
            "owner_id", user_id
        ).execute()
        profile["shops"] = shops.data or []

        shop_ids = [s["id"] for s in profile["shops"]]
        if shop_ids:
            products_res = (
                supabase.table("products")
                .select("id, title, shop_id, price_or_range, created_at")
                .in_("shop_id", shop_ids)
                .execute()
            )
            profile["products"] = products_res.data or []
        else:
            profile["products"] = []

        followers = supabase.table("followers").select("id", count="exact").eq(
            "following_id", user_id
        ).execute()
        following = supabase.table("followers").select("id", count="exact").eq(
            "follower_id", user_id
        ).execute()
        profile["followers_count"] = followers.count or 0
        profile["following_count"] = following.count or 0

        return jsonify(profile)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/profiles/<user_id>/follow", methods=["POST"])
@require_auth
def follow_user(user_id):
    try:
        follower_id = g.user_id
        if follower_id == user_id:
            return jsonify({"error": "Cannot follow yourself"}), 400
        supabase_admin.table("followers").insert({
            "follower_id": follower_id,
            "following_id": user_id,
        }).execute()
        return jsonify({"message": "Followed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- CONVERSATIONS & MESSAGES ----------------
def _conversation_participant_ids(conversation):
    return {str(conversation.get("buyer_id")), str(conversation.get("seller_id"))}


@app.route("/api/conversations", methods=["GET"])
@require_auth
def list_conversations():
    try:
        user_id = g.user_id
        res = (
            supabase_admin.table("conversations")
            .select("*")
            .or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}")
            .order("updated_at", desc=True)
            .execute()
        )
        conversations = res.data or []
        for conv in conversations:
            other_id = (
                conv["seller_id"]
                if str(conv["buyer_id"]) == str(user_id)
                else conv["buyer_id"]
            )
            prof = (
                supabase_admin.table("profiles")
                .select("id, name, profile_image")
                .eq("id", other_id)
                .execute()
            )
            conv["other_user"] = prof.data[0] if prof.data else {"id": other_id, "name": "User"}
            conv["unread_count"] = count_unread_messages(conv["id"], user_id)
        return jsonify(conversations)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations", methods=["POST"])
@require_auth
def start_conversation():
    try:
        buyer_id = g.user_id
        data = request.get_json(silent=True) or {}
        shop_id = data.get("shop_id")
        product_id = data.get("product_id")
        seller_id = data.get("seller_id")

        if shop_id and not seller_id:
            shop = supabase.table("shops").select("owner_id").eq("id", shop_id).execute()
            if not shop.data:
                return jsonify({"error": "Shop not found"}), 404
            seller_id = shop.data[0]["owner_id"]

        if product_id and not seller_id:
            prod = supabase_admin.table("products").select("shop_id").eq("id", product_id).execute()
            if not prod.data:
                return jsonify({"error": "Product not found"}), 404
            shop_id = shop_id or prod.data[0]["shop_id"]
            seller_id = get_shop_owner(shop_id)

        if shop_id and not seller_id:
            seller_id = get_shop_owner(shop_id)

        if not seller_id:
            return jsonify({"error": "seller_id or shop_id required"}), 400

        if str(seller_id) == str(buyer_id):
            return jsonify({"error": "Cannot message yourself"}), 400

        existing = (
            supabase_admin.table("conversations")
            .select("*")
            .eq("buyer_id", buyer_id)
            .eq("seller_id", seller_id)
        )
        if product_id:
            existing = existing.eq("product_id", product_id)
        found = existing.limit(1).execute()
        if found.data:
            return jsonify(found.data[0]), 200

        conversation_id = _find_or_create_conversation(
            buyer_id, seller_id, product_id=product_id
        )
        conv = supabase_admin.table("conversations").select("*").eq("id", conversation_id).execute()
        return jsonify(conv.data[0] if conv.data else {"id": conversation_id}), 201
    except Exception as e:
        print(f"[CONVERSATION] start failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations/<conversation_id>/messages", methods=["GET"])
@require_auth
def get_messages(conversation_id):
    try:
        user_id = g.user_id
        conv = supabase_admin.table("conversations").select("*").eq("id", conversation_id).execute()
        if not conv.data:
            return jsonify({"error": "Conversation not found"}), 404
        if user_id not in _conversation_participant_ids(conv.data[0]):
            return jsonify({"error": "Forbidden"}), 403

        msgs = (
            supabase_admin.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        normalized = [normalize_message(m) for m in (msgs.data or [])]
        return jsonify(normalized)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations/<conversation_id>/messages", methods=["POST"])
@require_auth
def send_message(conversation_id):
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}
        text = (data.get("content") or data.get("body") or "").strip()
        if not text:
            return jsonify({"error": "Message cannot be empty"}), 400

        conv = supabase_admin.table("conversations").select("*").eq("id", conversation_id).execute()
        if not conv.data:
            return jsonify({"error": "Conversation not found"}), 404
        conversation = conv.data[0]
        if user_id not in _conversation_participant_ids(conversation):
            return jsonify({"error": "Forbidden"}), 403

        msg = insert_message(conversation_id, user_id, text)
        update_conversation_after_message(conversation_id, text)

        recipient = (
            conversation["seller_id"]
            if str(user_id) == str(conversation["buyer_id"])
            else conversation["buyer_id"]
        )
        create_notification(
            recipient,
            "new_message",
            "New message",
            text[:120],
            {"conversation_id": conversation_id, "reference_id": conversation_id},
        )

        return jsonify(msg), 201
    except Exception as e:
        print(f"[MESSAGE] send failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations/<conversation_id>/read", methods=["POST"])
@require_auth
def mark_conversation_read(conversation_id):
    try:
        user_id = g.user_id
        conv = supabase_admin.table("conversations").select("*").eq("id", conversation_id).execute()
        if not conv.data or user_id not in _conversation_participant_ids(conv.data[0]):
            return jsonify({"error": "Forbidden"}), 403
        mark_messages_read(conversation_id, user_id)
        return jsonify({"message": "Marked read"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _parse_unit_price(price_or_range) -> float:
    """Extract first numeric value from price_or_range text (e.g. 'Rs 500 - Rs 2000')."""
    if price_or_range is None:
        return 0.0
    text = str(price_or_range).replace(",", "")
    matches = re.findall(r"\d+\.?\d*", text)
    if not matches:
        return 0.0
    try:
        return float(matches[0])
    except ValueError:
        return 0.0


def _find_or_create_conversation(buyer_id, seller_id, shop_id=None, product_id=None):
    """Return conversation id for buyer/seller (optional product scope). shop_id ignored if not in schema."""
    query = (
        supabase_admin.table("conversations")
        .select("id")
        .eq("buyer_id", buyer_id)
        .eq("seller_id", seller_id)
    )
    if product_id:
        query = query.eq("product_id", product_id)
    found = query.limit(1).execute()
    if found.data:
        return found.data[0]["id"]

    payload = {"buyer_id": buyer_id, "seller_id": seller_id}
    if product_id:
        payload["product_id"] = product_id

    res = supabase_admin.table("conversations").insert(payload).execute()
    if not res.data:
        raise Exception("Failed to create conversation")
    return res.data[0]["id"]


# ---------------- ORDERS ----------------
ORDER_STATUSES = {
    "pending", "accepted", "rejected", "preparing", "shipped", "completed", "cancelled",
}

SELLER_TRANSITIONS = {
    "pending": {"accepted", "rejected"},
    "accepted": {"preparing"},
    "preparing": {"shipped"},
    "shipped": {"completed"},
}
BUYER_TRANSITIONS = {"pending": {"cancelled"}}


@app.route("/api/orders", methods=["GET"])
@require_auth
def list_orders():
    try:
        user_id = g.user_id
        role = request.args.get("role", "buyer")
        query = supabase_admin.table("orders").select(
            "*, products(id, title, shop_id)"
        )
        if role == "seller":
            query = query.eq("seller_id", user_id)
        else:
            query = query.eq("buyer_id", user_id)
        res = query.order("created_at", desc=True).execute()
        rows = res.data or []
        seen = set()
        unique = []
        for row in rows:
            oid = row.get("id")
            if oid and oid in seen:
                continue
            if oid:
                seen.add(oid)
            unique.append(row)
        return jsonify(unique)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/orders", methods=["POST"])
@require_auth
def create_order():
    try:
        buyer_id = g.user_id
        data = request.get_json(silent=True) or {}
        product_id = data.get("product_id")
        if not product_id:
            return jsonify({"error": "product_id required"}), 400

        prod_res = supabase_admin.table("products").select("*").eq("id", product_id).execute()
        if not prod_res.data:
            return jsonify({"error": "Product not found"}), 404
        product = prod_res.data[0]
        shop_id = product.get("shop_id")
        if not shop_id:
            return jsonify({"error": "Product has no associated shop"}), 400

        seller_id = get_shop_owner(shop_id)
        if not seller_id:
            return jsonify({"error": "Seller not found for this product"}), 404

        if str(seller_id) == str(buyer_id):
            return jsonify({"error": "You cannot order your own product"}), 400

        quantity = int(data.get("quantity") or 1)
        if quantity < 1:
            quantity = 1

        unit_price = _parse_unit_price(product.get("price_or_range"))
        total_price = round(unit_price * quantity, 2)

        if not buyer_id or not seller_id:
            return jsonify({"error": "Invalid buyer or seller"}), 400

        order_payload = {
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "product_id": product_id,
            "status": "pending",
            "quantity": quantity,
            "unit_price": unit_price,
            "total_price": total_price,
            "notes": data.get("notes") or "",
        }

        order_res = supabase_admin.table("orders").insert(order_payload).execute()
        if not order_res.data:
            print(f"[ORDER] insert failed: {getattr(order_res, 'error', None)}")
            return jsonify({"error": "Failed to create order"}), 500

        order = order_res.data[0]
        create_notification(
            seller_id,
            "new_order",
            "New order",
            f"Order for {product.get('title', 'a product')}",
            notification_reference_data(order["id"]),
        )
        return jsonify(order), 201
    except Exception as e:
        print(f"[ORDER] create_order failed: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/orders/<order_id>/status", methods=["PATCH", "POST"])
@require_auth
def update_order_status(order_id):
    try:
        user_id = g.user_id
        data = request.get_json(silent=True) or {}
        raw_status = data.get("status")
        new_status = str(raw_status).strip().lower() if raw_status is not None else ""
        print(
            f"[ORDER STATUS] {request.method} order_id={order_id} user_id={user_id} "
            f"requested_status={new_status!r} body={data}"
        )
        if not new_status or new_status not in ORDER_STATUSES:
            return jsonify({
                "error": "Invalid status",
                "detail": f"Allowed: {', '.join(sorted(ORDER_STATUSES))}",
            }), 400

        order_res = supabase_admin.table("orders").select("*").eq("id", order_id).execute()
        if not order_res.data:
            print(f"[ORDER STATUS] order not found: {order_id}")
            return jsonify({"error": "Order not found"}), 404
        order = order_res.data[0]
        current = str(order.get("status") or "pending").strip().lower()
        buyer_id = order.get("buyer_id")
        seller_id = order.get("seller_id")
        print(
            f"[ORDER STATUS] current_status={current!r} buyer_id={buyer_id} "
            f"seller_id={seller_id}"
        )

        if not buyer_id or not seller_id:
            print("[ORDER STATUS] order missing buyer_id or seller_id")
            return jsonify({
                "error": "Order record is incomplete (missing buyer or seller)",
            }), 500

        is_buyer = str(buyer_id) == user_id
        is_seller = str(seller_id) == user_id

        if is_buyer:
            allowed = BUYER_TRANSITIONS.get(current, set())
            if new_status not in allowed:
                print(f"[ORDER STATUS] buyer transition denied: {current} -> {new_status}")
                return jsonify({
                    "error": "Transition not allowed",
                    "detail": f"Buyer cannot change status from '{current}' to '{new_status}'",
                }), 403
        elif is_seller:
            allowed = SELLER_TRANSITIONS.get(current, set())
            if new_status not in allowed:
                print(f"[ORDER STATUS] seller transition denied: {current} -> {new_status}")
                return jsonify({
                    "error": "Transition not allowed",
                    "detail": f"Seller cannot change status from '{current}' to '{new_status}'",
                }), 403
        else:
            print(
                f"[ORDER STATUS] forbidden — user {user_id} is neither buyer nor seller "
                f"(buyer={buyer_id}, seller={seller_id})"
            )
            return jsonify({
                "error": "Forbidden",
                "detail": "Only the buyer or seller on this order can update its status",
            }), 403

        try:
            update_res = (
                supabase_admin.table("orders")
                .update({"status": new_status})
                .eq("id", order_id)
                .execute()
            )
        except PostgrestAPIError as e:
            message = _format_postgrest_error(e)
            print(f"[ORDER STATUS] Supabase update APIError: {message}")
            print(f"[ORDER STATUS] raw error: {e.json() if hasattr(e, 'json') else e}")
            return jsonify({"error": message, "code": e.code}), 500

        if getattr(update_res, "error", None):
            err = update_res.error
            message = getattr(err, "message", None) or str(err)
            print(f"[ORDER STATUS] Supabase update error: {message}")
            return jsonify({"error": message}), 500

        if not update_res.data:
            print(f"[ORDER STATUS] update returned no rows for order_id={order_id}")
            return jsonify({
                "error": "Order status was not updated (no matching row)",
            }), 500

        print(f"[ORDER STATUS] updated order {order_id} to {new_status}")

        notify_type = {
            "accepted": "order_accepted",
            "rejected": "order_rejected",
            "shipped": "order_shipped",
            "completed": "order_completed",
        }.get(new_status)
        if notify_type and is_allowed_notification_type(notify_type):
            try:
                recipient = buyer_id if is_seller else seller_id
                titles = {
                    "accepted": "Order accepted",
                    "rejected": "Order rejected",
                    "shipped": "Order shipped",
                    "completed": "Order completed",
                }
                create_notification(
                    recipient,
                    notify_type,
                    titles.get(new_status, f"Order {new_status}"),
                    f"Your order has been {new_status}.",
                    notification_reference_data(order_id),
                )
            except Exception as notify_err:
                print(f"[ORDER STATUS] notification skipped: {notify_err}")

        refreshed = (
            supabase_admin.table("orders")
            .select("*, products(id, title, shop_id)")
            .eq("id", order_id)
            .execute()
        )
        if refreshed.data:
            return jsonify(refreshed.data[0])
        return jsonify({"message": "Status updated", "status": new_status, "id": order_id})
    except PostgrestAPIError as e:
        message = _format_postgrest_error(e)
        print(f"[ORDER STATUS] PostgrestAPIError: {message}")
        return jsonify({"error": message, "code": e.code}), 500
    except Exception as e:
        print(f"[ORDER STATUS] failed: {type(e).__name__}: {e}")
        return jsonify({"error": str(e)}), 500


# ---------------- NOTIFICATIONS ----------------
def _notification_rows_for_user(user_id: str, limit: int = 100):
    res = (
        supabase_admin.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = []
    for row in res.data or []:
        if not is_allowed_notification_type(row.get("type")):
            continue
        rows.append(normalize_notification(row))
    return rows


def _count_unread_notifications(user_id: str) -> int:
    rows = _notification_rows_for_user(user_id, limit=200)
    return sum(1 for row in rows if not row.get("read"))


def _mark_notifications_read(user_id: str, notification_id: str | None = None):
    for updates in ({"read": True, "is_read": True}, {"read": True}, {"is_read": True}):
        try:
            query = supabase_admin.table("notifications").update(updates).eq("user_id", user_id)
            if notification_id:
                query = query.eq("id", notification_id)
            query.execute()
            return
        except Exception:
            continue


@app.route("/api/notifications", methods=["GET"])
@require_auth
def list_notifications():
    try:
        return jsonify(_notification_rows_for_user(g.user_id))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/unread-count", methods=["GET"])
@require_auth
def notifications_unread_count():
    try:
        return jsonify({"count": _count_unread_notifications(g.user_id)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/<notification_id>/read", methods=["POST"])
@require_auth
def mark_notification_read(notification_id):
    try:
        _mark_notifications_read(g.user_id, notification_id)
        return jsonify({"message": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/read-all", methods=["POST"])
@require_auth
def mark_all_notifications_read():
    try:
        _mark_notifications_read(g.user_id)
        return jsonify({"message": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# saved_products table retained in DB but API endpoints removed (feature deprecated)


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)