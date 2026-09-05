# Reflex

A delivery coordination system for small Kenyan retailers, replacing the WhatsApp-and-phone-calls workflow with a shared, real-time view of where every delivery stands.

Three personas, one shared record:
- **Retailer staff** log a delivery request.
- **Dispatcher** sees open requests and assigns each to a rider.
- **Rider** sees their assigned deliveries and moves them through Assigned → Picked Up → Delivered, with a photo required to close out a delivery.

See `docs/architecture.md` for the full design rationale, the two open design questions this brief left for the builder (real-time sync and proof of delivery) and how this prototype answers them, and `docs/erd.mermaid` for the data model.

## Project structure

```
reflex/
├── backend/                 Express API + SQLite + Socket.io
│   ├── src/
│   │   ├── server.js         App entry point, wires everything together
│   │   ├── db/
│   │   │   ├── index.js        Opens the SQLite DB, runs schema.sql on boot
│   │   │   ├── schema.sql       Table definitions (see ERD)
│   │   │   └── seed.js          Demo users so there's no signup flow to build
│   │   ├── models/            One file per table — all SQL lives here
│   │   ├── controllers/       Request handling + business rules (status transitions, role checks)
│   │   ├── routes/            Express routers, one per resource
│   │   ├── middleware/
│   │   │   ├── currentUser.js   Prototype auth — reads X-User-Id header
│   │   │   └── upload.js        Multer config for proof-of-delivery photos
│   │   └── sockets/            Real-time broadcast layer (Socket.io)
│   ├── data/                 SQLite file lives here (gitignored)
│   ├── uploads/               Proof-of-delivery photos (gitignored)
│   └── package.json
│
├── frontend/                 Three static, framework-free persona apps
│   ├── shared/
│   │   ├── styles.css          Design tokens + shared components, one file for visual consistency
│   │   └── api.js              Fetch wrapper, socket connection, small utils — loaded by every page
│   ├── retailer/              Log requests, watch their own deliveries update live
│   ├── dispatcher/            See open requests, assign riders, see the full board
│   └── rider/                  Mobile-first cards: pick up, confirm with a photo, report a problem
│
└── docs/
    ├── architecture.md         System design, decisions, and trade-offs
    ├── erd.mermaid             Entity-relationship diagram
    └── sequence.mermaid         Delivery lifecycle sequence diagram
```

The **why** behind this structure: `models` / `controllers` / `routes` are split by responsibility (not by feature) because the whole backend is only three resources — a feature-based split would be over-engineering at this size. The frontend is three separate static apps rather than one app with role-based routing, because each persona has a genuinely different device context (dispatcher: desktop, monitoring a board; rider: phone, one-handed, outdoors) — see `docs/architecture.md` for the reasoning.

## Running it

**Backend**
```bash
cd backend
npm install
npm run seed     # creates demo users — run once
npm start        # http://localhost:4000
```

**Frontend**
The three persona apps are static files — no build step. Easiest is a static server from the `frontend/` folder, e.g.:
```bash
cd frontend
npx serve .
```
Then open:
- `/retailer/index.html`
- `/dispatcher/index.html`
- `/rider/index.html`

Each page has a "Logged in as" dropdown seeded with demo users for that role — pick one to act as that person. Open two personas side by side (e.g. dispatcher + rider) and watch a status change appear on the other screen instantly — that's the real-time sync in action.

## What's stubbed for the prototype, on purpose

- **Auth** is a dropdown, not a login. Every request carries an `X-User-Id` header. Swapping in real auth (session tokens, phone-number OTP — common in Kenyan consumer apps) only touches `middleware/currentUser.js`; nothing else changes.
- **One retailer's staff, one dispatcher pool** — the schema supports many retailers and many dispatchers already (see the ERD), but the prototype doesn't build retailer-to-dispatcher routing logic. Worth deciding deliberately before scaling past one coordination hub.
- **SQLite, not Postgres** — right choice for a single-process prototype; the schema is plain SQL and moves to Postgres with minimal changes (see `docs/architecture.md`).
