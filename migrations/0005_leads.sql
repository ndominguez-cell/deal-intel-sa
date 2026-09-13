CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  listing_id INTEGER REFERENCES listings(id),
  source TEXT NOT NULL DEFAULT 'landing_page',
  utm_source TEXT,
  utm_campaign TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS leads_status_created_idx ON leads (status, created_at DESC);
