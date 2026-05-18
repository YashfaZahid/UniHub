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
from datetime import timedelta
import os
import json
import uuid
from dotenv import load_dotenv
import requests
from supabase_client import supabase, supabase_admin

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
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'shops')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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


def _normalize_image_url(image_url):
    """Store local upload paths consistently; leave full http(s) URLs unchanged."""
    if not image_url:
        return image_url
    image_url = image_url.strip()
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return image_url
    if image_url.startswith("/uploads/"):
        return image_url
    if image_url.startswith("uploads/"):
        return f"/{image_url}"
    return image_url


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
        category = request.form.get("category") or (request.get_json(silent=True) or {}).get("category")
        description = request.form.get("description") or (request.get_json(silent=True) or {}).get("description", "")
        phone = request.form.get("phone") or (request.get_json(silent=True) or {}).get("phone", "")

        tags_raw = request.form.get("tags")
        if tags_raw:
            tags = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
        else:
            json_data = request.get_json(silent=True) or {}
            tags = json_data.get("tags", [])

        if not title or not category:
            return jsonify({"error": "Title and category required"}), 400

        res = supabase.table("shops").insert({
            "title": title,
            "description": description,
            "category": category,
            "tags": tags,
            "phone": phone,
            "owner_id": user_id,
            "average_rating": 0
        }).execute()

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

        return jsonify(res.data or [])

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

        data = request.get_json(silent=True) or {}
        title = data.get("title")

        if not title:
            return jsonify({"error": "Title is required"}), 400

        # Service-role client: Flask JWT auth does not set Supabase auth.uid(), so anon
        # key requests fail RLS on products. Owner check above is enforced in Flask.
        print(f"[AUTH DEBUG] create_product: inserting product into Supabase for shop_id={shop_id}")
        res = supabase_admin.table("products").insert({
            "shop_id": shop_id,
            "title": title,
            "description": data.get("description", ""),
            "price_or_range": data.get("price_or_range", "")
        }).execute()

        if not res.data:
            print(f"[AUTH DEBUG] create_product FAIL: Supabase insert returned no data")
            return jsonify({"error": "Failed to create product"}), 500

        print(f"[AUTH DEBUG] create_product SUCCESS: product_id={res.data[0].get('id')}")
        return jsonify(res.data[0]), 201

    except Exception as e:
        print(f"[AUTH DEBUG] create_product EXCEPTION: {type(e).__name__}: {e}")
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

        supabase_admin.table("products").delete().eq("id", product_id).execute()

        return jsonify({"message": "Product deleted"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)