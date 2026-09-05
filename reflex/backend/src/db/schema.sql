-- Reflex schema
-- SQLite for the prototype; see docs/architecture.md for the Postgres migration note.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('retailer_staff', 'dispatcher', 'rider')),
  shop_name     TEXT,               -- populated for retailer_staff
  phone         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id                  TEXT PRIMARY KEY,
  retailer_id         TEXT NOT NULL REFERENCES users(id),
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT NOT NULL,
  customer_address    TEXT NOT NULL,
  item_description    TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'Requested'
                        CHECK (status IN ('Requested','Assigned','Picked Up','Delivered','Failed','Cancelled')),
  assigned_rider_id   TEXT REFERENCES users(id),
  proof_photo_path    TEXT,          -- set when status -> Delivered
  proof_note          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id            TEXT PRIMARY KEY,
  delivery_id   TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  changed_by    TEXT NOT NULL REFERENCES users(id),
  note          TEXT,
  changed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider ON deliveries(assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_retailer ON deliveries(retailer_id);
CREATE INDEX IF NOT EXISTS idx_history_delivery ON delivery_status_history(delivery_id);
