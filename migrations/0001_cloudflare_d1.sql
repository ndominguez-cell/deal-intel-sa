PRAGMA foreign_keys = ON;

CREATE TABLE listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT,
  vin TEXT,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  body_type TEXT,
  price REAL,
  mileage INTEGER,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  lat REAL,
  lon REAL,
  dealer_name TEXT,
  is_dealer INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  listing_url TEXT,
  first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  title_status TEXT DEFAULT 'clean',
  image_urls TEXT DEFAULT '[]',
  raw_payload TEXT
);

CREATE INDEX listings_make_model_idx ON listings (make, model);
CREATE INDEX listings_city_state_idx ON listings (city, state);
CREATE INDEX listings_vin_idx ON listings (vin);
CREATE UNIQUE INDEX listings_source_ext_idx ON listings (source, external_id);
CREATE INDEX listings_active_idx ON listings (is_active);

CREATE TABLE listing_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  price REAL,
  mileage INTEGER,
  snapshot_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX snapshots_listing_idx ON listing_snapshots (listing_id);

CREATE TABLE listing_duplicates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_listing_id INTEGER NOT NULL REFERENCES listings(id),
  duplicate_listing_id INTEGER NOT NULL REFERENCES listings(id),
  match_type TEXT NOT NULL,
  detected_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX dupes_canonical_idx ON listing_duplicates (canonical_listing_id);

CREATE TABLE deal_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  deal_score REAL NOT NULL,
  market_value_est REAL,
  comp_count INTEGER,
  comp_price_median REAL,
  confidence REAL,
  savings_amount REAL,
  score_breakdown TEXT,
  score_reasons TEXT DEFAULT '[]',
  velocity_prediction REAL,
  wholesale_estimate REAL,
  suggested_offer REAL,
  scored_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX deal_scores_listing_idx ON deal_scores (listing_id);
CREATE INDEX deal_scores_score_idx ON deal_scores (deal_score);

CREATE TABLE market_comps_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  vehicle_segment TEXT NOT NULL,
  make TEXT,
  model TEXT,
  median_price REAL,
  inventory_count INTEGER,
  avg_days_on_market REAL,
  price_change_30d REAL,
  demand_velocity TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX market_comps_city_segment_idx
  ON market_comps_summary (city, vehicle_segment);

CREATE TABLE jobs_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  records_processed INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]'
);

CREATE INDEX jobs_runs_type_started_idx ON jobs_runs (job_type, started_at);
