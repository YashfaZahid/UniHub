# UniHub — Database Reference

> Generated from codebase analysis (migrations + `backend/app.py` + frontend usage).  
> **Note:** Base schema for `profiles`, `shops`, `orders`, `conversations`, etc. is assumed to exist in Supabase; only incremental migrations are in-repo.

---

## Table Status Summary

| Table | Status in current app | Notes |
|-------|----------------------|-------|
| `profiles` | **Active** | Auth-linked user records |
| `shops` | **Active** | One shop per owner (enforced in API) |
| `shop_images` | **Active** | Shop cover images (local or URL) |
| `products` | **Active** | Listings under a shop |
| `product_images` | **Active** | Supabase Storage URLs |
| `orders` | **Active** | Buyer/seller workflow |
| `conversations` | **Active** | Buyer–seller threads |
| `messages` | **Active** | Chat messages |
| `notifications` | **Active** | In-app alerts |
| `followers` | **Active** | Social follow (minimal UI) |
| `saved_products` | **DB only** | RLS exists; API removed |
| `categories` | **Removed** | Dropped by `remove_unused_features.sql` |
| `product_categories` | **Removed** | Dropped |
| `reviews` | **Removed** | Dropped |
| `shop_reviews` | **Removed** | Dropped |
| `requests` | **Removed** | Dropped |
| `matches` | **Removed** | Dropped |
| `comments` | **Removed** | Dropped |

---

## `profiles`

### Why it exists
Stores public user identity linked to Supabase Auth (`id` = `auth.users.id`).

### Columns (from code usage)

| Column | Type (inferred) | Purpose |
|--------|-----------------|--------|
| `id` | UUID (PK, FK → auth.users) | User identifier |
| `name` | TEXT | Display name |
| `email` | TEXT | Email (set on register) |
| `bio` | TEXT | Profile bio |
| `skills` | JSON/array | Skill tags (register default `[]`) |
| `has_shop` | BOOLEAN | Flag set `true` when shop created |
| `profile_image` | TEXT (URL) | Avatar public URL (`avatars` bucket) |
| `department` | TEXT | Edited on profile page |
| `semester` | TEXT | Edited on profile page |
| `university` | TEXT | Edited on profile page |
| `phone` | TEXT | Contact |
| `instagram` | TEXT | Social link |
| `linkedin` | TEXT | Social link |

*Additional columns may exist in Supabase but are unused by the app.*

### Relationships
- `shops.owner_id` → `profiles.id`
- `orders.buyer_id`, `orders.seller_id` → `profiles.id`
- `conversations.buyer_id`, `conversations.seller_id` → `profiles.id`
- `messages.sender_id` → `profiles.id`
- `notifications.user_id` → `profiles.id`
- `followers.follower_id`, `followers.following_id` → `profiles.id`

### Pages
- `/profile`, `/profile/:userId` — `UserProfile.jsx`
- Feed/shop cards — nested `profiles(name, profile_image)`

### APIs
- `POST /api/register` — insert profile
- `GET/PUT /api/profile` — Flask JWT only
- `GET /api/profiles/<user_id>` — public profile + shops/products counts
- `POST /api/profile/avatar` — avatar upload
- `POST /api/profiles/<user_id>/follow`
- Direct Supabase: `UserProfile.jsx` updates via `supabase.from('profiles').update(...)`

### Potential issues
- Profile edit uses **two paths**: Flask `PUT /api/profile` (name/bio/skills) vs direct Supabase client (department, social fields). Inconsistent auth and RLS behavior.
- `GET /api/profile` requires Flask JWT only; Supabase token alone fails.
- No email uniqueness enforcement in app layer beyond Supabase Auth.

---

## `shops`

### Why it exists
Each seller has a marketplace storefront (max one per user in API).

### Columns (from code)

| Column | Purpose |
|--------|---------|
| `id` | UUID PK |
| `owner_id` | FK → `profiles.id` |
| `title` | Shop name |
| `description` | Shop description |
| `tags` | JSON array (search/filter on feed) |
| `phone` | Contact (migration `shop_system.sql`) |
| `category` | TEXT (often empty string; normalized categories removed) |
| `created_at` | Sorting feed |

### Relationships
- One owner → many `products`
- One shop → many `shop_images`

### Pages
- `/feed`, `/shop/:id`, `/create-shop`

### APIs
- `POST /api/shops` — create (409 if shop exists)
- `GET /api/shops/<id>`
- `PATCH /api/shops/<id>`, `POST /api/shops/<id>/update`
- `GET /api/shops/feed` — paginated discovery

### Potential issues
- **One shop per user** — hard limit; no multi-shop support.
- Shop cover stored in `shop_images` + local disk (`/uploads/shops/`), not Supabase Storage — breaks on serverless/multi-instance deploy.
- Feed `sort` query param accepted but backend always orders by `created_at DESC` (sort not implemented in SQL).

---

## `shop_images`

### Why it exists
Separate table for shop cover/gallery (not a column on `shops`).

### Columns (from code)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `shop_id` | FK → `shops` |
| `image_url` | Path `/uploads/shops/...` or external URL |
| `caption` | Optional label |

### Pages
- Feed (`ShopCard`), `ShopPage`, `EditShop`

### APIs
- Created/updated via shop create/update routes (`_upsert_main_shop_image`)

### Potential issues
- RLS policies in `platform_rls_and_realtime.sql` enable public read; owner write via service role only in Flask.
- No dedicated REST endpoints for shop_images CRUD.

---

## `products`

### Why it exists
Sellable items/services listed under a shop.

### Columns (migration + code)

| Column | Purpose |
|--------|---------|
| `id` | UUID PK |
| `shop_id` | FK → `shops` ON DELETE CASCADE |
| `title` | Required |
| `description` | Optional |
| `price_or_range` | Free-text price (parsed loosely for orders) |
| `created_at` | Sorting |

### Pages
- `ShopPage`, `ProductPage`, profile product list

### APIs
- `GET/POST /api/shops/<shop_id>/products`
- `GET/PATCH/DELETE /api/products/<product_id>`

### Potential issues
- `price_or_range` is text; order total uses first number regex — unreliable for ranges like "500-2000".
- No inventory/stock field.
- No payment integration.

---

## `product_images`

### Why it exists
Multiple images per product in Supabase Storage bucket `product_images`.

### Columns (inferred)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `product_id` | FK → `products` |
| `image_url` | Public storage URL |
| `sort_order` | Gallery order |
| `is_primary` | Thumbnail flag |

### Pages
- `ProductPage` (`ProductGallery`), `ProductCard`, `AddProduct`

### APIs
- Created on product create/update (multipart)
- `DELETE /api/product-images/<id>`
- `POST /api/product-images/<id>/primary`

### Potential issues
- Storage policies documented as comments only in migrations.
- Deleting product removes storage objects best-effort.

---

## `orders`

### Why it exists
Tracks purchase requests between buyer and seller without payment gateway.

### Columns (migrations + code)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `buyer_id` | FK → profiles |
| `seller_id` | FK → profiles (shop owner) |
| `product_id` | FK → products |
| `status` | See state machine below |
| `quantity` | Default 1 |
| `unit_price` | NUMERIC, parsed from product |
| `total_price` | NUMERIC |
| `notes` | Buyer notes |
| `conversation_id` | Optional FK (unused in create flow) |
| `created_at` | Listing |

### Status state machine

```
pending → accepted | rejected | cancelled (buyer only from pending)
accepted → preparing
preparing → shipped
shipped → completed
```

### Pages
- `/orders` — buyer/seller tabs

### APIs
- `GET /api/orders?role=buyer|seller`
- `POST /api/orders`
- `PATCH|POST /api/orders/<id>/status`

### Potential issues
- Duplicate orders possible (no idempotency).
- `list_orders` dedupes by id in Python and frontend — suggests duplicate rows may exist in DB.
- No shipping address or payment proof.

---

## `conversations`

### Why it exists
Buyer–seller messaging threads, optionally scoped by `product_id`.

### Columns (inferred)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `buyer_id` | FK → profiles |
| `seller_id` | FK → profiles |
| `product_id` | Optional scope |
| `updated_at` | Sort inbox |
| `last_message_preview` | Inbox preview |

### Pages
- `/messages`, deep link `?conversation=<id>`

### APIs
- `GET/POST /api/conversations`
- Participant check on all message routes

### Potential issues
- Uniqueness: existing conversation lookup uses buyer+seller (+ product_id if set); edge cases if product_id omitted vs set may create duplicate threads.
- `shop_id` not stored on conversation (derived via product).

---

## `messages`

### Why it exists
Chat content within a conversation.

### Columns (inferred)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `conversation_id` | FK |
| `sender_id` | FK → profiles |
| `content` | Primary text column |
| `body` | Fallback column (schema tolerance) |
| `read` / `is_read` | Unread tracking |
| `created_at` | Ordering |

### Pages
- `MessagesPage` + Supabase Realtime subscription

### APIs
- `GET/POST /api/conversations/<id>/messages`
- `POST /api/conversations/<id>/read`

### Realtime
- Frontend subscribes to `postgres_changes` on `messages` (requires Supabase Realtime enabled).

### Potential issues
- Dual column names (`content` vs `body`) — insert retries both.
- Sending via Flask; realtime may show duplicate if not deduped (frontend merges on events).

---

## `notifications`

### Why it exists
In-app alerts for messages and order events.

### Columns (migration + code)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `user_id` | Recipient |
| `type` | See allowed types below |
| `title` | Short heading |
| `body` / `message` | Body text (normalized) |
| `data` | JSONB (conversation_id, order_id, etc.) |
| `read` / `is_read` | Read flag |
| `reference_id` | Optional UUID |
| `created_at` | Sort |

### Allowed types (`notification_utils.py`)
`new_message`, `new_order`, `order_accepted`, `order_rejected`, `order_shipped`, `order_completed`

### Pages
- `/notifications`, `NotificationBell`

### APIs
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/<id>/read`
- `POST /api/notifications/read-all`

### Potential issues
- Insert tries multiple payload shapes — indicates schema drift history.
- Unread count scans up to 200 rows in Python, not SQL `COUNT`.
- No push/email notifications.

---

## `followers`

### Why it exists
Social graph (follow user).

### Columns (inferred)

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `follower_id` | Who follows |
| `following_id` | Who is followed |

### Pages
- `UserProfile` — Follow button, counts on public profile

### APIs
- `POST /api/profiles/<user_id>/follow` only (no unfollow, no list)

### Potential issues
- Duplicate follow inserts likely error uncaught.
- Counts incremented optimistically in UI without refetch.

---

## Deprecated / removed tables

Documented in `backend/migrations/remove_unused_features.sql`:

- **`categories` / `product_categories`** — App uses `shops.category` text only.
- **`reviews` / `shop_reviews` / `order_reviews`** — No review UI or API.
- **`requests` / `matches`** — Request/matching marketplace feature removed.
- **`comments`** — Removed.
- **`saved_products`** — Table may still exist; `app.py` comment: *"saved_products table retained in DB but API endpoints removed"*.

---

## Storage buckets

| Bucket | Path pattern | Used by |
|--------|--------------|---------|
| `product_images` | `{product_id}/{uuid}.{ext}` | Product uploads |
| `avatars` | `{user_id}/avatar.{ext}` | Profile avatars |
| *(local)* | `backend/uploads/shops/` | Shop images via Flask static route |

---

## RLS summary (`platform_rls_and_realtime.sql`)

- **Public SELECT:** `shops`, `shop_images`, `products`, `product_images`, `profiles`
- **Owner writes:** shops, products, product_images (via `auth.uid()` = shop owner)
- **Participants:** conversations, messages, orders
- **Self only:** notifications, followers, saved_products

**Critical:** Flask uses `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses all RLS**. Authorization is enforced in Python route handlers, not Postgres policies, for API-driven operations.

---

## Entity relationship (text diagram)

```
auth.users (Supabase)
    │
    └── profiles (1)
            ├── shops (0..1 per API rule)
            │       ├── shop_images (*)
            │       └── products (*)
            │               └── product_images (*)
            ├── orders as buyer/seller (*)
            ├── conversations as buyer/seller (*)
            │       └── messages (*)
            ├── notifications (*)
            └── followers (as follower/following)

Storage: product_images bucket ← product_images table
         avatars bucket ← profiles.profile_image
         local disk ← shop_images.image_url (/uploads/shops/)
```
