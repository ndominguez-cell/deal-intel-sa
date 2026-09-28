-- Texas Used Car Market Index reports. One row per refresh; the page reads the latest.
-- payload is the full TexasIndexReport as JSON text.
CREATE TABLE IF NOT EXISTS market_index_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  source TEXT NOT NULL,
  as_of TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS market_index_region_asof_idx ON market_index_reports (region, as_of);
