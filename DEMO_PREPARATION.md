# UniHub — Demo Preparation Guide

> Use with [REPORT.md](./REPORT.md) (full audit) and [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md).

---

## Pre-demo checklist

### Services to run
1. **Supabase project** — online, migrations applied, Realtime enabled for `messages` and `notifications`
2. **Backend:** `cd backend` → activate venv → `python app.py` (port **5000**)
3. **Frontend:** `cd frontend` → `npm run dev` (port **5173**)

### Environment files
| Location | Required variables |
|----------|-------------------|
| `backend/.env` | `JWT_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

### Test accounts (recommended)
Prepare **two accounts** before the demo:

| Role | Purpose |
|------|---------|
| **Seller** | Has shop + products |
| **Buyer** | No shop; places orders and messages |

If email confirmation is enabled in Supabase, confirm both accounts in advance.

### Data prep (5 minutes)
1. Log in as **Seller** → create shop with image and tags
2. Add 2–3 products with photos
3. Log in as **Buyer** in another browser/incognito
4. Optionally place one pending order to show seller actions later

---

## Recommended demo sequence

### 1. Landing page (`/`)
**Show:** Branding, value proposition — student marketplace for creators.  
**Why first:** Frames the problem for the audience before technical depth.

### 2. Register + Login (Buyer account)
**Show:** Signup → redirect to login → login → land on `/feed`.  
**Why:** Establishes auth and that the app gates marketplace features behind login (soft gates on some pages).

**Talking point:** Supabase Auth handles credentials; Flask issues its own JWT for API calls.

### 3. Browse feed (`/feed`)
**Show:** Shop cards, search, infinite scroll.  
**Why:** Core discovery experience — the “marketplace” metaphor.

### 4. Open a shop (`/shop/:id`)
**Show:** Shop cover, owner profile link, product grid, tags.  
**Why:** Connects seller identity to catalog.

### 5. Product detail (`/product/:id`)
**Show:** Image gallery, price text, **Message Seller**, **Place Order** with notes.  
**Why:** Two main buyer actions — communication and transaction intent.

### 6. Message seller (`/messages`)
**Show:** Conversation opens; send a message; mention realtime update if second window open.  
**Why:** Demonstrates buyer–seller communication without exposing phone numbers immediately.

### 7. Place order
**Show:** Order success → `/orders` as buyer with `pending` status.  
**Why:** Order pipeline is a graded feature; shows structured workflow vs informal DMs only.

### 8. Switch to Seller account
**Show:** `/orders` seller tab → **Accept** order → optional **Preparing → Shipped → Completed**.  
**Why:** Proves role-based state machine and notifications to buyer.

### 9. Notifications (`/notifications` + bell)
**Show:** `new_order`, `order_accepted`, `new_message` entries; click through.  
**Why:** Shows event-driven UX and backend notification helper.

### 10. Seller: Create shop / add product (if time)
**Show:** `/create-shop` or Add Product modal — multipart upload to Supabase Storage.  
**Why:** Demonstrates seller tooling and image pipeline.

### 11. Profile (`/profile`)
**Show:** Avatar upload, bio edit, optional follow on another user's profile.  
**Why:** Humanizes sellers; shows dual update path (Flask avatar vs Supabase profile fields).

---

## What NOT to demo (unless asked)

- Forgot password link (non-functional `href="#"`)
- Reviews, categories, saved products, requests/matches (removed)
- Payment/checkout (not implemented)
- Production deployment
- Sort options on feed beyond “newest” (backend ignores sort param)

---

## Demo narrative (30-second pitch)

> UniHub is a campus marketplace where students open a shop, list creative services or products, and other students discover them on a feed, message sellers, and place orders with a clear status workflow — built with React, Flask, and Supabase for auth, database, storage, and realtime messaging.

---

## Troubleshooting during demo

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 401 on create shop | Expired/missing `token` in localStorage | Re-login |
| 401 on profile GET | Using Supabase token on `@jwt_required` route | Re-login to refresh Flask JWT |
| Images broken | Backend not running or wrong `BASE_URL` | Start Flask on :5000 |
| Shop image 404 | File not in `backend/uploads/shops/` | Re-upload shop image |
| Realtime not updating | Realtime not enabled / no Supabase session | Check `VITE_*` env; re-login |
| Notifications empty | Migration not applied / wrong schema | Run `notifications_schema_fix.sql` |
| “Shop already exists” | Seller already has shop | Use existing shop or second seller account |

---

## Instructor Q&A — 55 questions with model answers

### Architecture & stack

**1. Why Supabase?**  
PostgreSQL with hosted Auth, Storage, and Realtime reduces boilerplate. The team uses it for user accounts, relational data, product images, avatars, and live message/notification updates while keeping custom business logic in Flask.

**2. Why Flask instead of only Supabase Edge Functions?**  
The app needs multipart uploads, dual JWT validation, order state machines, and service-role database access with explicit ownership checks. A Python monolith in `app.py` centralizes that logic; Supabase is the data/auth platform, not the app server.

**3. Why React?**  
SPA with fast iteration via Vite, component reuse for shop/product cards, and React Router for clear page-based flows (feed, shop, product, messages, orders).

**4. Why split frontend and backend?**  
Security (service role key never in browser), clear API contract, and ability to add mobile or other clients later against the same REST API.

**5. What is the overall architecture?**  
React → Flask REST → Supabase (Postgres + Auth + Storage); browser also connects to Supabase Realtime for messages/notifications.

**6. Is this a monolith or microservices?**  
Monolith: single Flask file for API, single React app for UI.

**7. How do you run it locally?**  
Flask on port 5000, Vite on 5173, Supabase cloud project with env keys in `backend/.env` and `frontend/.env`.

**8. What ports are used?**  
5000 (API), 5173 (Vite default), Supabase hosted HTTPS.

**9. Where is business logic?**  
Primarily `backend/app.py` plus helpers (`message_utils.py`, `notifications.py`, `image_utils.py`).

**10. Why is `api.js` outside `src/`?**  
Historical structure; imported as `../../api` from pages. It is the shared Axios client for Flask.

### Authentication

**11. How does registration work?**  
`POST /api/register` → Supabase Auth signup → insert `profiles` row if missing → return Flask JWT + optional Supabase access token.

**12. How does login work?**  
`POST /api/login` → Supabase password grant → load profile → return Flask JWT, Supabase tokens, `user_id`, `user` object.

**13. What tokens are stored in the browser?**  
`token` (Flask JWT), `supabase_access_token`, `supabase_refresh_token`, `user_id`, `user` JSON.

**14. Which token is sent to Flask?**  
`getAuthToken()` prefers Flask JWT, then Supabase access token.

**15. What is `@require_auth` vs `@jwt_required`?**  
`@jwt_required` accepts only Flask JWT (used on register-time routes like `create_shop`, `get_profile`). `@require_auth` accepts Flask JWT **or** Supabase access token (most protected routes).

**16. Are there server sessions?**  
No. Stateless Bearer authentication only.

**17. How long do JWTs last?**  
7 days (`JWT_ACCESS_TOKEN_EXPIRES` in `app.py`).

**18. What happens on logout?**  
`supabase.auth.signOut()` + `clearAuthSession()` + redirect home.

**19. Is there password reset?**  
UI link exists on login page but points to `#` — **not implemented** in app code.

**20. Can users sign up and auto-login?**  
Signup redirects to login; session is **not** stored after register.

### Database

**21. What tables are actively used?**  
profiles, shops, shop_images, products, product_images, orders, conversations, messages, notifications, followers.

**22. What happened to reviews and categories?**  
Removed per `remove_unused_features.sql`; no API or UI remains.

**23. What is `saved_products`?**  
Table may exist; API was removed (comment in `app.py`).

**24. How many shops can a user have?**  
One — `create_shop` returns 409 if a shop already exists for `owner_id`.

**25. How are prices stored?**  
`products.price_or_range` as free text; orders parse first number for `unit_price`.

**26. What are order statuses?**  
pending, accepted, rejected, preparing, shipped, completed, cancelled — with role-specific transitions.

**27. Who can cancel an order?**  
Buyer only, from `pending` → `cancelled`.

**28. Who can accept/reject?**  
Seller, from `pending`.

**29. Are conversations unique?**  
Backend looks up buyer+seller (+ product_id if provided); duplicates possible in edge cases.

**30. What notification types exist?**  
new_message, new_order, order_accepted, order_rejected, order_shipped, order_completed.

### Messaging & realtime

**31. How does messaging work?**  
REST: create/list conversations, send messages via Flask. UI subscribes to Supabase Realtime on `messages` for live updates.

**32. Why send messages through Flask if Realtime exists?**  
Authorization, notification side effects, and consistent schema handling (`content` vs `body`); Realtime is for push to clients.

**33. How are unread messages counted?**  
`count_unread_messages` queries messages where `read=false` and sender ≠ current user.

**34. Is typing indicators supported?**  
No.

**35. Can you message without a product?**  
Yes — `startConversation` accepts `shop_id` or `seller_id`; product_id optional.

### Images & storage

**36. How are product images stored?**  
Supabase Storage bucket `product_images`, path `{product_id}/{uuid}.ext`, public URL in `product_images` table.

**37. How are avatars stored?**  
Bucket `avatars`, path `{user_id}/avatar.{ext}`, via `POST /api/profile/avatar`.

**38. How are shop images stored?**  
Local disk `backend/uploads/shops/`, URL `/uploads/shops/...` — **not** Supabase Storage in current code.

**39. What file types are allowed?**  
png, jpg, jpeg, gif, webp (`allowed_file` in `image_utils.py`).

**40. What is the avatar size limit?**  
5 MB (`MAX_AVATAR_BYTES`).

### Orders & marketplace

**41. Is payment integrated?**  
No payment gateway; orders are intent/tracking only.

**42. How is order total calculated?**  
`unit_price` × `quantity`; unit_price from regex on `price_or_range`.

**43. Can you order your own product?**  
No — API returns 400.

**44. How does the feed work?**  
`GET /api/shops/feed` with search (title/description ilike), pagination, attaches shop_images.

**45. Does sort on feed work?**  
UI sends `sort` param; backend always orders by `created_at` DESC — **sort not fully implemented server-side**.

### Security

**46. What is RLS?**  
Row Level Security in Postgres; policies in `platform_rls_and_realtime.sql` restrict anon/authenticated access.

**47. Does the backend use RLS?**  
Flask uses **service role**, which bypasses RLS; authorization is manual in routes.

**48. Is the service role key exposed?**  
Only in `backend/.env` — must never ship to frontend.

**49. What are main security risks?**  
Leaked service role key, debug mode, verbose auth logging, no rate limiting, local shop file serving, dual auth confusion.

**50. Is CORS configured?**  
Yes — localhost:5173 and :3000 only.

### Frontend

**51. Is there a global auth context?**  
No — `localStorage` checks per page.

**52. Are routes protected?**  
Not at router level; pages redirect or alert when `user_id` missing.

**53. Why direct Supabase update on profile?**  
`UserProfile` updates extended fields via anon client; avatar uses Flask.

**54. How does the notification bell work?**  
Poll every 20s + Realtime on `notifications` + custom `NOTIFICATIONS_CHANGED` event.

**55. What happens on 401?**  
Axios interceptor logs error; some pages redirect to login manually.

### Future / production

**56. What is needed for production?**  
Configurable API URL, WSGI server, HTTPS, cloud storage for shop images, rate limits, remove debug logging, email confirmation strategy, proper forgot-password.

**57. What would you build next?**  
Payments, reviews (if desired), unfollow, saved products API, admin moderation, unified profile API, server-side sort/filter, tests.

**58. Known bugs to mention honestly?**  
Feed sort param ignored; possible duplicate orders/conversations; follow count optimistic; signup doesn’t auto-login; shop images not cloud-portable.

**59. Why dedupe orders in code?**  
Defensive handling — suggests duplicate rows or join duplicates may occur; investigate DB constraints.

**60. How do migrations work?**  
Manual SQL files in `backend/migrations/` run in Supabase SQL Editor — not automated CI/CD.

---

## Role assignment for team demo

| Speaker focus | Sections to own |
|---------------|-----------------|
| Product | Landing, feed, user journey |
| Backend | Auth, orders API, Flask + Supabase split |
| Database | Tables, RLS, migrations |
| Frontend | React routes, Realtime, api.js |
| QA / honesty | Limitations, known bugs, future work |

---

## 5-minute executive brief (read before demo)

UniHub connects student sellers and buyers: sellers create one shop, list products with images, and buyers discover shops on a feed, message sellers, and place orders tracked through pending → accepted → shipped → completed. The stack is React (UI), Flask (API and authorization), and Supabase (database, auth, storage, realtime). Several features were deliberately removed (reviews, categories, requests) to focus the MVP. The demo should use two accounts, show feed → product → message → order → seller accept, and mention that payments and reviews are out of scope. Main risks for production are the service-role bypass pattern, local shop image storage, and hardcoded localhost URLs.
