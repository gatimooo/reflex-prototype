# Reflex — System Architecture

## 1. Problem recap

Small Kenyan retailers (electronics shops, pharmacies, hardware stores) coordinate deliveries over WhatsApp and phone calls. That leaves no record of who a delivery is assigned to, no visibility into its status, and no proof it was completed — so retailers can't answer "where's my customer's order" without calling around, and there's no evidence trail if something goes missing.

Reflex gives three personas a shared, real-time record of every delivery from request to confirmed drop-off:

| Persona | Can do |
|---|---|
| Retailer staff | Log a delivery request; watch its status update live |
| Dispatcher | See all open requests; assign each to a rider; see the whole board |
| Rider | See deliveries assigned to them; mark picked up; confirm delivery with a photo |

## 2. The two open design questions

The brief deliberately left two things for the builder to decide and justify. Here's the reasoning behind each.

### 2.1 How updates reach everyone in real time

**Decision: WebSocket broadcast (Socket.io) over polling.**

Every mutation — a new request, an assignment, a status change, a proof upload — updates SQLite, then the server emits the full updated delivery record over a single `delivery:update` (or `delivery:created`) event to every connected client. Each client merges it into its local list. There are no per-role rooms or filtering on the server; each frontend filters client-side (e.g. a rider only renders deliveries assigned to them). At the scale of one dispatcher and a handful of riders per retailer, broadcasting everything is simpler and cheap; if the fleet grows into the hundreds, this is the first place to add room-based scoping.

**Why not polling?** A dispatcher watching a live board, or a retailer waiting to hear their delivery moved, wants sub-second feedback. Polling every few seconds either feels laggy or wastes requests; a push-based socket gives instant updates for free.

**Known trade-off, called out rather than hidden:** riders in the field don't always have reliable data connectivity. Socket.io reconnects automatically once a connection returns, but if a rider goes offline entirely, they can't advance a delivery's status until they're back online — there is no offline queue in this prototype. That's an explicit scope decision (see §6), not an oversight: building true offline-first sync (local writes queued and reconciled later) is a meaningfully bigger system, and doing it well requires deciding what "the real delivery status" is when two devices disagree — a design problem in its own right.

### 2.2 How delivery gets confirmed

**Decision: a required photo, attached to the specific delivery, at the moment status moves to Delivered.**

The rider's last action isn't a status dropdown — it's `POST /deliveries/:id/proof` with an image file. The server refuses to mark a delivery Delivered without one (see `deliveryController.attachProof`), and refuses the status-update endpoint from moving anything to Delivered at all (it explicitly redirects to the proof endpoint). This makes "delivered" mean something: there's a photo tied to that specific delivery ID, timestamped, alongside the rider who captured it.

**Why a photo over a signature or a PIN code?** A signature needs a touchscreen interaction most feature-conscious riders' phones handle poorly, and a PIN code requires the customer to be present with a phone to receive one — not guaranteed for a hardware-store delivery left with a guard or neighbor. A photo (of the item at the door, or with whoever received it) works in more real-world Kenyan delivery scenarios and is the lowest-friction proof a rider can capture with any smartphone camera.

**Trade-off, named directly:** a photo alone doesn't prove non-repudiation (it doesn't stop a rider from photographing an empty doorstep). That's an acceptable prototype-stage limitation; a production version might pair the photo with GPS coordinates at capture time, or a customer-side confirmation tap, discussed in §6.

## 3. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| API | Node.js + Express | Small surface area (3 resources), no need for a heavier framework |
| Database | SQLite (`better-sqlite3`) | Zero setup for a prototype; schema is plain SQL, ports to Postgres with almost no changes when concurrent writes need to scale beyond a single process |
| Real-time | Socket.io | Handles reconnection and fallback transports out of the box; see §2.1 |
| File storage | Local disk via Multer | Fine for a prototype; swap for S3-compatible object storage before production (photos need to survive a redeploy) |
| Auth | `X-User-Id` header + a "log in as" dropdown | Deliberately not real auth — see §5 |
| Frontend | Three static HTML/CSS/vanilla-JS apps, no framework | See §4 |

## 4. Why three separate frontends, not one app with roles

Retailer staff, dispatchers, and riders don't just have different permissions — they have different device contexts:

- **Retailer staff**: likely a shop counter, a shared computer or tablet, low-frequency use (log a request, glance at status).
- **Dispatcher**: a monitoring view, probably a desktop or laptop, open all day, wide layout with two panels (open requests + full board).
- **Rider**: a phone, likely mid-motion or one-handed, outdoors — large tap targets, dark background readable in sunlight, minimal typing (see `frontend/shared/styles.css`, `.rider-card`).

Building one responsive app that reshapes itself per role would fight against these differences rather than embrace them. Three small static apps sharing one `styles.css` (for visual consistency) and one `api.js` (for shared request/socket logic) keep each experience purpose-built without duplicating real logic — the only duplication is markup, which is cheap at this size.

## 5. Auth: what's real, what's stubbed

There's no password or session token. Each frontend has a "Logged in as" dropdown pulled from a seeded `users` table, and every API request carries the chosen user's ID in an `X-User-Id` header. The server trusts this header completely, which is **not secure** — anyone can claim to be any user by setting the header themselves.

This is a deliberate, contained stub: `middleware/currentUser.js` is the *only* place that would change for real auth (phone-number OTP is the natural fit for this market — most retailers and riders already use a phone number as their identity on M-Pesa and WhatsApp). Every route, controller, and role check already reads from `req.user`, so swapping the middleware's internals doesn't touch business logic.

## 6. What's explicitly out of scope (and why that's a design choice, not a gap)

| Not built | Why it's excluded here | What it would take |
|---|---|---|
| Offline-first rider app | Needs a real conflict-resolution model (what happens if a rider updates status offline after a dispatcher reassigns the delivery?) — a design problem bigger than this prototype | Local write queue (IndexedDB), background sync, server-side conflict rules |
| Multi-retailer dispatch routing | The schema supports many retailers (see ERD), but nothing routes a retailer's requests to *their* dispatcher — all dispatchers currently see all requests from all retailers | A `retailer_dispatcher` mapping table, or a `region`/`zone` column and routing rule |
| Real authentication | Out of scope for proving the core coordination loop | Phone OTP or similar, isolated to `currentUser.js` |
| Push notifications | Sockets only reach a client while its tab/app is open | Web Push (for browser) or FCM (for a future native rider app) triggered from the same events already broadcast over sockets |
| GPS-stamped proof | Would strengthen non-repudiation on the delivery photo | Capture `navigator.geolocation` alongside the photo upload, store lat/lng on `deliveries` |

## 7. Data model

See `erd.mermaid` for the full diagram. Three tables:

- **`users`** — one table for all three roles, discriminated by `role`. Chosen over separate `retailers`/`dispatchers`/`riders` tables because all three share the same shape (name, phone) and a single `currentUser` lookup stays simple; if roles diverge significantly in the future (e.g. riders need a vehicle type, retailers need billing info), splitting becomes worth it.
- **`deliveries`** — the core entity. `status` is a single source of truth column, but every transition is also appended to...
- **`delivery_status_history`** — an append-only audit trail. This is what actually answers "where has this delivery been and who touched it" — the kind of accountability trail that doesn't exist in a WhatsApp thread today. `deliveries.status` is a fast-to-query denormalized cache of the latest history entry.

Status transitions are enforced server-side (`deliveryController.js`, `VALID_TRANSITIONS`), not left to the frontend to police:

```
Requested → Assigned → Picked Up → Delivered
                ↓            ↓
             Cancelled    Failed
```

`Delivered` can only be reached through the proof-upload endpoint, never the generic status endpoint (§2.2).

## 8. API surface

All endpoints except `GET /api/users*` require an `X-User-Id` header; role-restricted ones are marked.

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Liveness check |
| GET | `/api/users` | — | List seeded demo users (powers the login dropdowns) |
| GET | `/api/users/riders` | — | List riders (powers the dispatcher's assign dropdown) |
| POST | `/api/deliveries` | retailer_staff | Log a new delivery request |
| GET | `/api/deliveries` | any | List deliveries, scoped by role (own requests / own assignments / everything) |
| GET | `/api/deliveries/:id` | any | Full detail + status history |
| PATCH | `/api/deliveries/:id/assign` | dispatcher | Assign a rider to a `Requested` delivery |
| PATCH | `/api/deliveries/:id/status` | rider (assignee only) | Move to `Picked Up`, `Failed`, or `Cancelled` |
| POST | `/api/deliveries/:id/proof` | rider (assignee only) | Attach a photo; only valid transition to `Delivered` |

## 9. Real-time events

| Event | Emitted when | Payload |
|---|---|---|
| `delivery:created` | A retailer logs a new request | Full delivery record |
| `delivery:update` | Assignment, status change, or proof upload | Full updated delivery record |

See `sequence.mermaid` for the full request-to-delivery flow across all three personas.
