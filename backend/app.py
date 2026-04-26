from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
import os
from dotenv import load_dotenv
import requests
from supabase_client import supabase

load_dotenv()

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')

jwt = JWTManager(app)

CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
print("SUPABASE_URL:", SUPABASE_URL)


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

        # 4. Create JWT token
        token = create_access_token(identity=user_id)

        return jsonify({
            'token': token,
            'user_id': user_id
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
        token = create_access_token(identity=user_id)

        profile_res = supabase.table("profiles").select("*").eq("id", user_id).execute()
        profile = profile_res.data[0] if profile_res.data else None

        return jsonify({
            'token': token,
            'user_id': user_id,
            'user': profile
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


# ---------------- SHOPS ----------------
@app.route("/api/shops", methods=["POST"])
@jwt_required()
def create_shop():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        # 🔍 1. Check if shop already exists
        existing_shop = supabase.table("shops") \
            .select("*") \
            .eq("owner_id", user_id) \
            .execute()

        if existing_shop.data and len(existing_shop.data) > 0:
            return jsonify({
                "error": "Shop already exists"
            }), 409  # 409 = Conflict

        # 🔍 2. Validate input
        if not data.get("title") or not data.get("category"):
            return jsonify({"error": "Title and category required"}), 400

        # 🛒 3. Create shop
        res = supabase.table("shops").insert({
            "title": data.get("title"),
            "description": data.get("description"),
            "category": data.get("category"),
            "tags": data.get("tags", []),
            "owner_id": user_id,
            "average_rating": 0
        }).execute()

        # 👤 4. Update profile
        supabase.table("profiles").update({
            "has_shop": True
        }).eq("id", user_id).execute()

        return jsonify(res.data), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)