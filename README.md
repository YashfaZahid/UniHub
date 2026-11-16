# UniHub

UniHub is a campus marketplace. A student opens a shop, lists a skill or a product, and other students discover it, message the seller, and place an order.

## What it does

- Register and log in with a JWT
- Profile, avatar upload, and public profiles
- Follow another student
- Create and edit a shop, with shop images
- Add products, galleries, and a primary image
- Home feed of shops and products
- Conversations, messages, and read state
- Orders with quantity, price, and status
- In-app notifications
- Shop insights for the owner

The React app talks to a Flask API. Postgres, storage, and row-level policies are in Supabase. SQL migrations are in `backend/migrations/`.

## Run

```bash
# API
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py                 # http://localhost:5000
```

`.env` needs `JWT_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

```bash
# UI
cd frontend
npm install
npm run dev                   # Vite, usually http://localhost:5173
```

The UI calls `http://localhost:5000`. Apply the SQL files in `backend/migrations/` to the Supabase project before signing up.

## Stack

React 19, Vite, Tailwind, React Router, Flask, Flask-JWT-Extended, Supabase.

## Limits

CORS in the API allows `localhost:5173` and `localhost:3000`. A deployed origin needs to be added there. Shop insights are the owner's view of their own listings and orders, not a third-party analytics product.
