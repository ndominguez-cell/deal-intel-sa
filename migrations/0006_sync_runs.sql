CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','error','empty')),
  listings_fetched INTEGER NOT NULL DEFAULT 0,
  listings_written INTEGER NOT NULL DEFAULT 0,
  sources_summary TEXT NOT NULL DEFAULT '{}',
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS sync_runs_started_idx ON sync_runs (started_at DESC);
