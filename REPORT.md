# UniHub — Complete Project Documentation & Audit Report

**Generated:** June 1, 2026  
**Purpose:** Pre-demo team onboarding and technical audit  
**Method:** Full codebase analysis (no code modified)  
**Companion docs:** [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md) | [DEMO_PREPARATION.md](./DEMO_PREPARATION.md)

---

## Section 13 — Executive Summary (read first)

UniHub is a **student marketplace web app** where users register, optionally open a **single shop**, list **products/services with images**, appear on a **searchable feed**, **message** sellers, and **place orders** with a multi-step status workflow. The stack is **React 19 + Vite** (frontend), **Flask** (REST API), and **Supabase** (PostgreSQL, Auth, Storage, Realtime).

**Strengths:** End-to-end flows for auth, shops, products, messaging, orders, and notifications; clear order state machine; product images on Supabase Storage; realtime chat and notification hints.

**Critical honesty:** No payments; reviews/categories/requests **removed**; shop images on **local disk**; backend uses **service role** (bypasses RLS); **dual auth decorators**; feed **sort** not implemented server-side; profile updates split across Flask and Supabase client; **not production-ready** without hardening.

**Best demo path:** Register → feed → product → message → order → seller accept → notifications. Use **two browsers/accounts**.

---

## Section 1 — Project Overview

### What UniHub is
UniHub (branded “Where Creativity Meets Opportunity” on the landing page) is a **campus-oriented marketplace** for students to showcase skills and sell services or products. It combines a **shop-centric catalog** (each seller has a storefront) with **direct messaging** and **order tracking** without integrating a payment processor.

### Problem it solves
Students and creators often sell informally on social media with no structured catalog, order history, or status tracking. UniHub centralizes discovery (feed), seller identity (profile + shop), communication (chat), and transaction intent (orders + notifications).

### Target users
| User | Goals |
|------|--------|
| **Student sellers** | Create a shop, list offerings, respond to messages, fulfill orders |
| **Student buyers** | Discover shops, ask questions, place orders |
| **Visitors** | View marketing home page; most actions require login |

### Main features (implemented)
- User registration and login (Supabase Auth + Flask JWT)
- User profiles with avatar and extended fields
- One shop per user with cover image and tags
- Product CRUD with multiple images (Supabase Storage)
- Marketplace feed with search and pagination
- Buyer–seller messaging with realtime updates
- Order placement and status workflow
- In-app notifications (message + order events)
- Follow user (basic)

### Main features (removed or not in code)
- Reviews and ratings (`remove_unused_features.sql`)
- Category tables (uses `shops.category` text only)
- Requests / matching system
- Saved products API (table may remain)
- Comments
- Payment / checkout
- Password reset (UI placeholder only)

### Marketplace workflow
```
Seller: Register → Login → Create Shop → Add Products
Buyer:  Register → Login → Browse Feed → Open Shop/Product
        → Message Seller (optional) → Place Order
Seller: Orders tab → Accept/Reject → Preparing → Shipped → Completed
Both:   Notifications + Messages for updates
```

### User journey (buyer)
1. Land on marketing home → Sign up → Log in  
2. Browse `/feed` → open shop → open product  
3. Message seller or place order with notes  
4. Track order on `/orders` (buyer role)  
5. Receive notifications on status changes  

### User journey (seller)
1. Log in → `/create-shop` (once)  
2. Manage shop on `/shop/:id` — edit, add products  
3. `/messages` for buyer inquiries  
4. `/orders` (seller role) to accept and progress orders  
5. `/notifications` for new orders and messages  

---

## Section 2 — System Architecture

See **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** for diagrams and depth.

### Frontend summary
- **Framework:** React 19, Vite 8, React Router 7, Tailwind + page CSS  
- **Routing:** Flat routes in `App.jsx` — no nested layouts or `ProtectedRoute`  
- **Structure:** `pages/` (screens), `components/` (shared UI), `utils/`, `api.js` (Flask client)  

### Backend summary
- **Flask monolith** `app.py` — all routes  
- **Auth:** Supabase Auth HTTP + Flask-JWT-Extended  
- **DB:** Supabase Python client with service role  

### Database
- Hosted **Supabase PostgreSQL**  
- Schema evolved via SQL files in `backend/migrations/`  

### Storage
- **Product images:** bucket `product_images`  
- **Avatars:** bucket `avatars`  
- **Shop images:** local `backend/uploads/shops/`  

### Realtime
- **Messages:** `MessagesPage` subscribes to `postgres_changes` on `messages`  
- **Notifications:** `NotificationBell` + polling  

### Architecture diagram (text)

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌──────────────┐
    │ Flask API  │  │  Supabase  │  │ localStorage │
    │ :5000      │  │  Realtime  │  │ tokens       │
    └─────┬──────┘  └─────┬──────┘  └──────────────┘
          │               │
          └───────┬───────┘
                  ▼
         ┌────────────────┐
         │ Supabase Cloud │
         │ Auth·DB·Store  │
         └────────────────┘
```

---

## Section 3 — Database Analysis

Full per-table reference: **[DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md)**.

### Quick reference

| Table | In active use? | Primary consumers |
|-------|----------------|-------------------|
| profiles | Yes | Auth, profile, feed embed |
| shops | Yes | Feed, shop page, orders |
| shop_images | Yes | Feed cards, shop header |
| products | Yes | Shop, product page, orders |
| product_images | Yes | Gallery, cards |
| orders | Yes | Orders page |
| conversations | Yes | Messages |
| messages | Yes | Messages + Realtime |
| notifications | Yes | Bell, notifications page |
| followers | Yes | Profile follow |
| saved_products | DB only | None (API removed) |
| categories, product_categories | Removed | — |
| reviews, shop_reviews | Removed | — |
| requests, matches | Removed | — |

For each active table, DATABASE_REFERENCE.md documents: purpose, columns, relationships, pages, APIs, and potential issues.

### Cross-cutting DB concerns
1. **RLS enabled** in migrations but **bypassed** by Flask service role  
2. **Schema tolerance** — messages and notifications try multiple column layouts  
3. **Removed features** may still exist in older Supabase projects until migration run  
4. **`conversation_id` on orders** — column exists; create order does not link conversation  

---

## Section 4 — File-by-File Explanation

### Backend (`backend/`)

| File | Purpose | Key functions / notes |
|------|---------|----------------------|
| `app.py` | Main application | All routes; `require_auth`, `get_shop_owner`, order transitions, feed |
| `supabase_client.py` | DB client | `create_client` with service role; documents RLS bypass |
| `image_utils.py` | Uploads | `upload_product_image`, `upload_avatar`, `allowed_file`, buckets |
| `notifications.py` | Side effects | `create_notification()` |
| `notification_utils.py` | Types/normalize | `ALLOWED_NOTIFICATION_TYPES`, `normalize_notification` |
| `message_utils.py` | Chat persistence | `insert_message`, `mark_messages_read`, `count_unread_messages` |
| `requirements.txt` | Dependencies | Flask, flask-cors, flask-jwt-extended, supabase, requests, dotenv |
| `.env.example` | Env template | JWT + Supabase keys |
| `migrations/*.sql` | Manual schema | RLS, notifications fix, feature removal |

### Frontend root

| File | Purpose |
|------|---------|
| `frontend/api.js` | Axios client, all API wrappers, `setAuthSession`, `formatApiError` |
| `frontend/package.json` | React/Vite deps (not axios/supabase) |
| `frontend/vite.config.js` | Vite + React Compiler |
| `frontend/index.html` | SPA shell |

### Frontend `src/`

| File | Purpose | Dependencies |
|------|---------|--------------|
| `main.jsx` | Bootstrap | `initSupabaseSession`, ErrorBoundary |
| `App.jsx` | Routes | All page imports |
| `supabaseClient.js` | Anon Supabase | Env `VITE_SUPABASE_*` |
| `index.css` | Global styles | theme, components, Tailwind |

### Pages (`src/pages/`)

| File | Responsibilities |
|------|------------------|
| `Home.jsx` | Static marketing; links to auth |
| `Login.jsx` | `POST /api/login`, `setAuthSession`, → `/feed` |
| `Signup.jsx` | `POST /api/register`, → `/login` |
| `FeedPage.jsx` | `fetchFeed`, infinite scroll, search |
| `CreateShop.jsx` | Multipart `createShop`, one shop limit handling |
| `ShopPage.jsx` | Shop + products; owner: add/edit/delete; visitor: message |
| `ProductPage.jsx` | Gallery, message, place order |
| `MessagesPage.jsx` | Conversations, chat, Realtime subscription |
| `OrdersPage.jsx` | Buyer/seller tabs, status buttons |
| `NotificationsPage.jsx` | List, mark read, navigate to message/order |
| `UserProfile.jsx` | Public/own profile, avatar, Supabase profile update, follow, logout |

### Components (`src/components/`)

| File | Responsibilities |
|------|------------------|
| `AppLayout.jsx` | Nav: Feed, Messages, Orders, bell, Profile/Login |
| `ShopCard.jsx` | Feed card → shop or owner profile |
| `ProductCard.jsx` | Product tile; owner delete |
| `ProductGallery.jsx` | Image carousel |
| `AddProduct.jsx` | Modal multipart product create |
| `EditShop.jsx` | Modal multipart shop update |
| `NotificationBell.jsx` | Unread dot; poll + Realtime |
| `ErrorBoundary.jsx` | React error boundary |

### Utils (`src/utils/`)

| File | Responsibilities |
|------|------------------|
| `images.js` | `resolveImageUrl`, placeholders, shop/avatar URLs |
| `avatarUpload.js` | Validation wrapper for `uploadProfileAvatar` |
| `messages.js` | `getMessageText` — content/body normalization |
| `notificationEvents.js` | `NOTIFICATIONS_CHANGED` custom event |

---

## Section 5 — Feature Documentation

### Authentication
| Aspect | Detail |
|--------|--------|
| **Purpose** | Secure access to marketplace actions |
| **Workflow** | Supabase signup/login via Flask → JWT + tokens in localStorage |
| **Files** | `app.py` (register/login), `Login.jsx`, `Signup.jsx`, `api.js` |
| **Tables** | `profiles` (created on register) |

### Profile management
| Aspect | Detail |
|--------|--------|
| **Purpose** | Identity, contact, avatar |
| **Workflow** | View via `GET /api/profiles/:id`; edit bio/social via Supabase client; avatar via Flask upload |
| **Files** | `UserProfile.jsx`, `app.py`, `avatarUpload.js` |
| **Tables** | `profiles` |

### Shop creation
| Aspect | Detail |
|--------|--------|
| **Purpose** | Seller storefront |
| **Workflow** | Multipart POST → shop row + optional local image → `shop_images` → `has_shop=true` |
| **Files** | `CreateShop.jsx`, `app.py` `create_shop` |
| **Tables** | `shops`, `shop_images`, `profiles` |

### Product creation
| Aspect | Detail |
|--------|--------|
| **Purpose** | List items for sale |
| **Workflow** | Owner-only POST multipart → product + storage uploads |
| **Files** | `AddProduct.jsx`, `app.py` `create_product` |
| **Tables** | `products`, `product_images` + Storage |

### Product images
| Aspect | Detail |
|--------|--------|
| **Purpose** | Visual catalog |
| **Workflow** | Upload on create/update; delete/set primary via API |
| **Files** | `image_utils.py`, `ProductGallery.jsx`, product routes |
| **Tables** | `product_images`, bucket `product_images` |

### Feed
| Aspect | Detail |
|--------|--------|
| **Purpose** | Discover shops |
| **Workflow** | Paginated GET with search on title/description |
| **Files** | `FeedPage.jsx`, `ShopCard.jsx`, `feed_shops` |
| **Tables** | `shops`, `shop_images`, `profiles` |

### Messaging
| Aspect | Detail |
|--------|--------|
| **Purpose** | Buyer–seller communication |
| **Workflow** | Start conversation → send messages → mark read; Realtime for UI |
| **Files** | `MessagesPage.jsx`, `message_utils.py`, conversation routes |
| **Tables** | `conversations`, `messages` |

### Orders
| Aspect | Detail |
|--------|--------|
| **Purpose** | Structured purchase requests |
| **Workflow** | Buyer creates pending → seller/buyer transitions per rules |
| **Files** | `ProductPage.jsx`, `OrdersPage.jsx`, order routes |
| **Tables** | `orders`, `products` |

### Notifications
| Aspect | Detail |
|--------|--------|
| **Purpose** | Alert users to messages and order changes |
| **Workflow** | `create_notification` on events; list/mark read via API |
| **Files** | `notifications.py`, `NotificationBell.jsx`, `NotificationsPage.jsx` |
| **Tables** | `notifications` |

### Reviews
**Not implemented** — tables dropped by migration.

### Requests
**Not implemented** — tables dropped by migration.

### Categories
**Not implemented** — normalized tables dropped; `shops.category` string rarely used (often `""`).

### Follow
| Aspect | Detail |
|--------|--------|
| **Purpose** | Social connection |
| **Workflow** | POST follow only; UI increments count locally |
| **Files** | `UserProfile.jsx`, `follow_user` |
| **Tables** | `followers` |

---

## Section 6 — End-to-End Workflows

### Register
| Step | Action |
|------|--------|
| 1 | User submits name, email, password on `Signup.jsx` |
| 2 | `POST /api/register` → Supabase Auth signup |
| 3 | If new user, insert `profiles` row |
| 4 | Flask returns `token`, `access_token`, `user_id` |
| 5 | Frontend navigates to `/login` (session **not** saved) |

**Tables:** `profiles` (insert)  
**Files:** `Signup.jsx`, `app.py` `register`

---

### Login
| Step | Action |
|------|--------|
| 1 | User submits email/password on `Login.jsx` |
| 2 | `POST /api/login` → Supabase token endpoint |
| 3 | Load profile; issue Flask JWT |
| 4 | `setAuthSession` → localStorage |
| 5 | Navigate `/feed`; `main.jsx` already ran `initSupabaseSession` on next load |

**Tables:** `profiles` (read)  
**Files:** `Login.jsx`, `api.js`, `app.py` `login`

---

### Create profile (implicit on register)
Profile row created during register with `name`, `email`, `skills: []`, `has_shop: false`, `bio: ''`. Extended fields edited later on profile page.

**Tables:** `profiles`  
**Files:** `app.py` `register`, `UserProfile.jsx`

---

### Create shop
| Step | Action |
|------|--------|
| 1 | Authenticated user opens `/create-shop` |
| 2 | Checks `localStorage.token` |
| 3 | `POST /api/shops` multipart (`@jwt_required`) |
| 4 | Reject if shop exists for owner |
| 5 | Insert `shops`, optional image → `shop_images`, `has_shop=true` |

**Tables:** `shops`, `shop_images`, `profiles`  
**Files:** `CreateShop.jsx`, `app.py` `create_shop`

---

### Create product
| Step | Action |
|------|--------|
| 1 | Shop owner opens Add Product on `ShopPage` |
| 2 | `POST /api/shops/:id/products` multipart |
| 3 | Verify owner; insert `products` |
| 4 | For each image: Storage upload + `product_images` insert |

**Tables:** `products`, `product_images`  
**Files:** `AddProduct.jsx`, `app.py` `create_product`

---

### Upload product image
Occurs inside create/update product (multipart `images` field). Standalone: `PATCH /api/products/:id` with new files, or `POST .../primary`, `DELETE /api/product-images/:id`.

**Tables:** `product_images` + Storage  
**Files:** `image_utils.py`, `app.py`

---

### Message seller
| Step | Action |
|------|--------|
| 1 | Buyer on `ProductPage` clicks Message |
| 2 | `POST /api/conversations` with `product_id`, `shop_id` |
| 3 | Resolve seller; find or create conversation |
| 4 | Navigate `/messages?conversation=:id` |
| 5 | Send via `POST .../messages`; notification to seller |

**Tables:** `conversations`, `messages`, `notifications`  
**Files:** `ProductPage.jsx`, `MessagesPage.jsx`, `app.py`

---

### Place order
| Step | Action |
|------|--------|
| 1 | Buyer on `ProductPage` submits order with notes |
| 2 | `POST /api/orders` with `product_id`, `quantity`, `notes` |
| 3 | Compute price from `price_or_range`; insert `orders` status `pending` |
| 4 | Notify seller; redirect `/orders` |

**Tables:** `orders`, `notifications`, `products`, `shops`  
**Files:** `ProductPage.jsx`, `OrdersPage.jsx`, `app.py` `create_order`

---

### Accept order
| Step | Action |
|------|--------|
| 1 | Seller on `/orders` (seller tab) |
| 2 | `POST /api/orders/:id/status` `{ status: "accepted" }` |
| 3 | Validate seller transition pending→accepted |
| 4 | Update row; notify buyer `order_accepted` |

**Tables:** `orders`, `notifications`  
**Files:** `OrdersPage.jsx`, `app.py` `update_order_status`

---

### Reject order
Same as accept with `status: "rejected"` → notification `order_rejected`.

---

### Notifications (lifecycle)
| Event | Type | Recipient |
|-------|------|-----------|
| New message | `new_message` | Other participant |
| New order | `new_order` | Seller |
| Accepted | `order_accepted` | Buyer |
| Rejected | `order_rejected` | Buyer |
| Shipped | `order_shipped` | Buyer |
| Completed | `order_completed` | Buyer |

**Files:** `notifications.py`, `NotificationBell.jsx`, `NotificationsPage.jsx`

---

## Section 7 — Feature Limitations

| Feature | Limitations |
|---------|-------------|
| **Auth** | No forgot-password; signup doesn’t auto-login; email confirmation depends on Supabase project settings |
| **Profile** | Split update paths; `GET /api/profile` needs Flask JWT only |
| **Shops** | One per user; shop images on local disk; no multi-image gallery API for shops |
| **Products** | Text price only; no inventory; no variants |
| **Feed** | Sort param ignored server-side; category filter unused |
| **Messaging** | No attachments; no block/report; duplicate conversations possible |
| **Orders** | No payment; price parsing fragile; duplicates possible; no shipping address |
| **Notifications** | No push/email; unread count inefficient; schema workarounds |
| **Follow** | No unfollow; duplicate follows may error |
| **Reviews/Categories/Requests** | Removed entirely |
| **Saved products** | No UI/API |
| **Security** | Service role bypass; debug mode; verbose token logging |
| **Deployment** | localhost URLs hardcoded; `debug=True` |

---

## Section 8 — Security Analysis

### Authentication
- Supabase handles password hashing and session tokens  
- Flask issues secondary JWT signed with `JWT_SECRET_KEY`  
- Bearer token in `Authorization` header  

### Authorization
- Enforced in Python via `g.user_id` vs `owner_id` / participant IDs  
- **Not** enforced by RLS for API operations (service role)  

### RLS policies (`platform_rls_and_realtime.sql`)
- Public read on marketplace tables  
- Owner/participant write rules for shops, products, messages, orders  
- **Effective for:** direct Supabase client access from browser (profile update, Realtime)  
- **Ineffective for:** Flask routes using service role  

### Storage policies
- Documented as SQL comments in migrations (`product_images`, `avatars`)  
- Flask uploads use service role — bypass storage RLS  

### Weaknesses and risks

| Risk | Severity | Detail |
|------|----------|--------|
| Service role key leak | **Critical** | Full database + storage access |
| RLS bypass | **High** | All API writes trust Flask only |
| `debug=True` | **High** | Stack traces, dev server in production entry |
| Auth debug logging | **Medium** | Partial token masks in logs |
| No rate limiting | **Medium** | Brute force, spam |
| CORS localhost only | **Low** for dev | Must reconfigure for prod |
| localStorage tokens | **Medium** | XSS would steal session |
| Shop image static route | **Medium** | Path traversal mitigated by Flask `send_from_directory` but no auth on read |
| `@jwt_required` vs `@require_auth` | **Medium** | Confusing failures if only Supabase token present |
| Profile update via anon client | **Medium** | Depends on RLS; different from Flask path |
| No CSRF | **Low** | Bearer tokens reduce cookie CSRF; localStorage pattern |

### Missing protections
- HTTPS enforcement  
- Content Security Policy  
- Input sanitization beyond basic validation  
- File content validation (magic bytes)  
- Audit logging  
- Admin/moderation roles  
- IP throttling  

---

## Section 9 — Demo Preparation Guide

See **[DEMO_PREPARATION.md](./DEMO_PREPARATION.md)** for:
- Pre-demo checklist  
- Recommended demo sequence with rationale  
- Troubleshooting table  
- **60 Q&A** with model answers  
- Team role assignments  

**Recommended sequence:** Register → Create Shop → Add Product → Feed browse → Message Seller → Place Order → Accept Order → Notifications.

---

## Section 10 — Possible Demo Questions

Fifty-five+ questions with answers are in **DEMO_PREPARATION.md** (sections “Instructor Q&A”). Topics cover architecture, auth, database, messaging, images, orders, security, frontend, and production readiness.

---

## Section 11 — Bugs and Technical Debt

### Known bugs / behavioral issues
1. Feed `sort` query parameter not applied in `feed_shops` (always `created_at DESC`)  
2. `CreateShop` checks only `token`, not `supabase_access_token` — may block valid sessions  
3. Login “Forgot password?” is non-functional (`href="#"`)  
4. Follow button increments count without verifying server success  
5. Order/list deduplication in API and UI suggests duplicate data possible  
6. `Signup` success check includes `response.data.message` which register endpoint doesn’t return  
7. ProductPage / MessagesPage may show duplicate messages if Realtime + REST overlap (depends on handler)  
8. `get_profile` / `update_profile` incompatible with Supabase-only token  

### Code smells
- Monolithic `app.py` (~1600+ lines)  
- Duplicate Supabase clients (`supabase` and `supabase_admin` identical)  
- Multiple insert payload attempts for messages/notifications (schema drift)  
- Extensive `[AUTH DEBUG]` print statements  
- Hardcoded `BASE_URL` and API URLs in Login/Signup  
- `axios`/`supabase` dependencies at repo root, not in `frontend/package.json`  

### Technical debt
- No automated tests (no test files found in app source)  
- Manual SQL migrations, no version tracking in DB  
- Mixed storage strategy (local vs Supabase) for images  
- No API versioning  
- No OpenAPI/Swagger spec  
- No CI/CD configuration in repo (not verified)  
- Feature removal migration may be out of sync with live DB  

### Refactoring priorities
1. Extract Flask blueprints (auth, shops, orders, messages)  
2. Unify auth decorator and profile API  
3. Move shop images to Supabase Storage  
4. Environment-based API base URL  
5. Add integration tests for order state machine  

---

## Section 12 — Future Roadmap

### Build next (high value)
1. **Payment integration** (Stripe/campus wallet) or clear “pay offline” acknowledgment  
2. **Unified profile API** — single Flask path for all profile fields  
3. **Cloud storage for shop images** — remove local disk dependency  
4. **Forgot password** via Supabase Auth  
5. **Unfollow** and follow list  
6. **Inventory / availability** flag on products  

### Improve next
1. Server-side feed sort and category filter  
2. Rate limiting and security headers  
3. Remove debug logging; `debug=False` + gunicorn  
4. Configurable `VITE_API_URL` / `BASE_URL`  
5. Automated migration runner  
6. E2E tests (Playwright) for demo-critical paths  

### Production readiness gaps
| Area | Status |
|------|--------|
| HTTPS | Not configured |
| Secrets | Manual `.env` |
| Scalability | Single Flask process; local uploads |
| Monitoring | None |
| Backups | Supabase default only |
| Email verification | Project-dependent |
| Legal (Terms/Privacy) | Placeholder links on auth pages |

---

## Appendix A — API Route Reference

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/register` | Public |
| POST | `/api/login` | Public |
| GET | `/api/profile` | JWT |
| PUT | `/api/profile` | JWT |
| POST | `/api/shops` | JWT |
| GET | `/api/shops/:id` | Public |
| PATCH | `/api/shops/:id` | require_auth |
| POST | `/api/shops/:id/update` | require_auth |
| GET | `/api/shops/:id/products` | Public |
| POST | `/api/shops/:id/products` | require_auth |
| GET | `/api/shops/feed` | Public |
| GET | `/api/products/:id` | Public |
| PATCH | `/api/products/:id` | require_auth |
| DELETE | `/api/products/:id` | require_auth |
| DELETE | `/api/product-images/:id` | require_auth |
| POST | `/api/product-images/:id/primary` | require_auth |
| POST | `/api/profile/avatar` | require_auth |
| GET | `/api/profiles/:user_id` | Public |
| POST | `/api/profiles/:user_id/follow` | require_auth |
| GET/POST | `/api/conversations` | require_auth |
| GET/POST | `/api/conversations/:id/messages` | require_auth |
| POST | `/api/conversations/:id/read` | require_auth |
| GET/POST | `/api/orders` | require_auth |
| PATCH/POST | `/api/orders/:id/status` | require_auth |
| GET | `/api/notifications` | require_auth |
| GET | `/api/notifications/unread-count` | require_auth |
| POST | `/api/notifications/:id/read` | require_auth |
| POST | `/api/notifications/read-all` | require_auth |
| GET | `/uploads/shops/:filename` | Public |

---

## Appendix B — Order State Machine

```
                    ┌───────────┐
                    │  pending  │
                    └─────┬─────┘
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌───────────┐
    │ accepted │   │ rejected │   │ cancelled │
    └────┬─────┘   └──────────┘   │ (buyer)   │
         ▼                          └───────────┘
    ┌───────────┐
    │ preparing │
    └─────┬─────┘
          ▼
    ┌──────────┐
    │ shipped  │
    └────┬─────┘
         ▼
    ┌───────────┐
    │ completed │
    └───────────┘
```

---

## Appendix C — What could not be determined from codebase

- Exact initial `CREATE TABLE` for `profiles`, `shops`, `orders`, `conversations` (only ALTER/migration snippets in repo)  
- Whether `remove_unused_features.sql` was applied on your Supabase instance  
- Supabase project Auth settings (email confirm, OAuth providers)  
- Production hosting target  
- Whether CI/CD exists outside this repository  

---

*End of report. For demo day, start with Section 13, then use DEMO_PREPARATION.md during the presentation.*
