# UniHub — System Architecture

> Based on analysis of `backend/`, `frontend/`, and `backend/migrations/`.

---

## High-level overview

UniHub is a **student marketplace** web application with:

- **React SPA** (Vite) — UI, routing, partial Supabase client usage
- **Flask API** — business logic, auth tokens, all primary CRUD
- **Supabase** — PostgreSQL, Auth, Storage, Realtime

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React)                          │
│  Routes: /, /login, /feed, /shop/:id, /product/:id, /messages…  │
│  localStorage: Flask JWT + Supabase access/refresh tokens        │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ Axios → localhost:5000       │ @supabase/supabase-js
                ▼                              ▼
┌───────────────────────────┐    ┌──────────────────────────────────┐
│   Flask (app.py)          │    │  Supabase                        │
│   - JWT + require_auth    │    │  - Auth (signup/login via REST)  │
│   - Service role client   │───▶│  - PostgreSQL (PostgREST)        │
│   - Local shop uploads    │    │  - Storage (product_images,      │
│   - CORS dev origins      │    │    avatars)                      │
└───────────────────────────┘    │  - Realtime (messages, notifs)   │
                                 └──────────────────────────────────┘
```

---

## Frontend architecture

### Stack
| Technology | Version (package.json) | Role |
|------------|------------------------|------|
| React | 19.2.x | UI |
| React Router | 7.14.x | Client routing |
| Vite | 8.x | Build/dev server |
| Tailwind CSS | 3.4.x | Utility styles (+ custom CSS per page) |
| Axios | root `package.json` | HTTP to Flask |
| @supabase/supabase-js | root `package.json` | Realtime + direct profile update |

**Dependency note:** `axios` and `@supabase/supabase-js` are declared in repo root `package.json`, not `frontend/package.json`. They resolve at dev time via hoisting/Vite prebundle.

### Entry and bootstrap
1. `index.html` → `src/main.jsx`
2. `initSupabaseSession()` restores Supabase session from `localStorage`
3. `ErrorBoundary` wraps `App.jsx`
4. `BrowserRouter` defines all routes (no route-level auth guard)

### Routing map

| Path | Component | Layout |
|------|-----------|--------|
| `/` | `Home` | Marketing (no `AppLayout`) |
| `/login`, `/signup` | `Login`, `Signup` | Auth pages |
| `/feed` | `FeedPage` | `AppLayout` |
| `/profile`, `/profile/:userId` | `UserProfile` | `AppLayout` |
| `/create-shop` | `CreateShop` | Standalone form |
| `/shop/:id` | `ShopPage` | `AppLayout` |
| `/product/:id` | `ProductPage` | `AppLayout` |
| `/messages` | `MessagesPage` | `AppLayout` |
| `/orders` | `OrdersPage` | `AppLayout` |
| `/notifications` | `NotificationsPage` | `AppLayout` |

### Component structure

```
frontend/
├── api.js                    # Central Flask API client
├── src/
│   ├── App.jsx               # Router
│   ├── supabaseClient.js     # Anon Supabase client
│   ├── components/
│   │   ├── AppLayout.jsx     # Nav shell
│   │   ├── NotificationBell.jsx
│   │   ├── ShopCard.jsx, ProductCard.jsx, ProductGallery.jsx
│   │   ├── AddProduct.jsx, EditShop.jsx
│   │   └── ErrorBoundary.jsx
│   ├── pages/                # Route screens
│   └── utils/
│       ├── images.js         # URL resolution
│       ├── avatarUpload.js
│       ├── messages.js
│       └── notificationEvents.js
```

### API client pattern (`frontend/api.js`)
- **Base URL:** hardcoded `http://localhost:5000`
- **Auth:** Request interceptor adds `Authorization: Bearer <token>`
  - Prefers `localStorage.token` (Flask JWT)
  - Falls back to `localStorage.supabase_access_token`
- **Multipart:** Shop/product/avatar uploads use raw `axios` with manual Bearer header
- **401:** Logged in dev only; no global logout redirect

### Auth state (no React Context)
| localStorage key | Set when | Purpose |
|------------------|----------|---------|
| `token` | Login | Flask JWT |
| `supabase_access_token` | Login | Supabase + API fallback |
| `supabase_refresh_token` | Login | `setSession` for Realtime |
| `user_id` | Login | UI "logged in" checks |
| `user` | Login | Cached profile JSON |

Auth checks are **per-page** (`localStorage.user_id`), not centralized.

---

## Backend architecture

### Structure (monolithic Flask)

| Module | Responsibility |
|--------|----------------|
| `app.py` (~1626 lines) | All HTTP routes, auth, domain logic |
| `supabase_client.py` | Service-role Supabase client |
| `image_utils.py` | Upload helpers, buckets, shop folder |
| `notifications.py` | `create_notification()` |
| `notification_utils.py` | Type allowlist, normalization |
| `message_utils.py` | Insert/read/unread messages |

No Flask blueprints or application factory pattern.

### API surface (grouped)

**Auth:** `POST /api/register`, `POST /api/login`  
**Profile:** `GET/PUT /api/profile`, `POST /api/profile/avatar`, `GET /api/profiles/:id`, `POST .../follow`  
**Shops:** `POST /api/shops`, `GET/PATCH /api/shops/:id`, `POST .../update`, `GET .../products`, `GET /api/shops/feed`  
**Products:** `GET/PATCH/DELETE /api/products/:id`, product image routes  
**Messaging:** `/api/conversations`, `/api/conversations/:id/messages`, `.../read`  
**Orders:** `GET/POST /api/orders`, `PATCH|POST /api/orders/:id/status`  
**Notifications:** list, unread-count, mark read  
**Static:** `GET /uploads/shops/<filename>`

### Authentication flow

```
Register/Login
    │
    ├─▶ Supabase Auth REST (anon key)
    │       signup or password grant
    │
    ├─▶ Create/load profiles row
    │
    └─▶ Issue Flask JWT (7-day expiry, HS256, JWT_SECRET_KEY)

Protected request
    │
    ├─▶ @jwt_required()  → Flask JWT only (3 routes)
    │
    └─▶ @require_auth     → Flask JWT OR Supabase access token
            verified via GET /auth/v1/user
            sets g.user_id
```

**No server-side sessions.** Stateless Bearer tokens only.

### Authorization pattern
1. Authenticate → `g.user_id`
2. For resources: compare `g.user_id` to `shops.owner_id`, conversation participants, or order buyer/seller
3. Order status: role-specific transition tables (`SELLER_TRANSITIONS`, `BUYER_TRANSITIONS`)

### Supabase usage
- **Auth:** HTTP `requests` to Supabase Auth API (not Python `supabase.auth` SDK)
- **Database:** `supabase` / `supabase_admin` (identical service-role instance) → PostgREST
- **Storage:** `product_images`, `avatars` buckets
- **RLS:** Enabled in migrations but **bypassed** by service role in Flask

---

## Database layer

See [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md) for per-table detail.

**Active tables:** profiles, shops, shop_images, products, product_images, orders, conversations, messages, notifications, followers

**Removed (migration):** categories, reviews, requests, matches, comments, etc.

---

## Storage architecture

```
Product images ──▶ Supabase bucket: product_images
                   Path: {product_id}/{uuid}.ext
                   URL stored in product_images.image_url

Avatars ─────────▶ Supabase bucket: avatars
                   Path: {user_id}/avatar.{ext}
                   URL stored in profiles.profile_image

Shop covers ─────▶ Local filesystem: backend/uploads/shops/
                   Served: GET /uploads/shops/{filename}
                   URL stored in shop_images.image_url
```

---

## Realtime architecture

| Feature | Mechanism | Table |
|---------|-----------|-------|
| Live chat | Supabase `postgres_changes` | `messages` |
| Notification bell | Realtime + 20s polling + custom event | `notifications` |

**Requirements:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in frontend env
- Realtime publication enabled for tables (commented SQL in migration)
- `initSupabaseSession()` so anon client has valid JWT for private channels

Message **sends** go through Flask (service role); **delivery UI** can update via Realtime.

---

## Request flow diagrams

### Place order

```
ProductPage → POST /api/orders { product_id, notes, quantity }
    → Flask: load product, resolve seller from shop.owner_id
    → Insert orders (status=pending)
    → create_notification(seller, new_order)
    → Navigate /orders
```

### Send message

```
MessagesPage → POST /api/conversations/:id/messages { content }
    → Flask: verify participant
    → insert_message (messages table)
    → update_conversation_after_message
    → create_notification(recipient, new_message)
    → Realtime may push to other client's subscription
```

### Create product with images

```
AddProduct → POST /api/shops/:id/products (multipart)
    → Flask: verify shop owner
    → Insert products row
    → For each file: upload_product_image → Storage
    → Insert product_images rows
```

---

## Environment configuration

### Backend (`backend/.env`)
```
JWT_SECRET_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Frontend (Vite env)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### CORS (Flask)
Allowed origins: `http://localhost:5173`, `http://localhost:3000`

---

## Deployment topology (current state)

Designed for **local development only:**
- Flask `debug=True` on port 5000
- Vite dev server on 5173
- Hardcoded API base URL
- Shop images on local disk

**Not production-ready** without: configurable API URL, production WSGI server, cloud storage for shop images, secrets management, HTTPS, rate limiting.

---

## Security architecture summary

| Layer | Implementation | Gap |
|-------|----------------|-----|
| Transport | Not enforced in code | HTTPS required in prod |
| Auth | JWT + Supabase token | Dual decorator split |
| DB access | Service role | Full DB if key leaked |
| RLS | Defined but bypassed by backend | Defense in depth missing |
| File upload | Extension whitelist, 5MB avatar | No virus scan |
| CORS | Dev origins only | Must update for prod domain |

See REPORT.md Section 8 for full security analysis.
