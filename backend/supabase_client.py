"""
Supabase clients for the Flask backend.

Auth model: Flask issues JWTs after Supabase Auth signup/login. The browser never
sends a Supabase session to PostgREST, so auth.uid() is NULL on database requests
made with the anon key — RLS policies that depend on auth.uid() will block writes.

The service-role key bypasses RLS and must ONLY live in backend environment
variables (SUPABASE_SERVICE_ROLE_KEY). Never prefix with VITE_ or ship it to the
frontend.
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise Exception("Missing SUPABASE_URL environment variable")

if not SUPABASE_SERVICE_ROLE_KEY:
    raise Exception(
        "Missing SUPABASE_SERVICE_ROLE_KEY. "
        "Add it to backend/.env from Supabase Dashboard → Project Settings → API → service_role (secret)."
    )

# Server-side DB access only — bypasses RLS; authorization is enforced in Flask routes.
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Default import used across app.py for all backend database operations.
supabase: Client = supabase_admin
