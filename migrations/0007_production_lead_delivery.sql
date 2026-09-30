ALTER TABLE leads ADD COLUMN request_id TEXT;
ALTER TABLE leads ADD COLUMN preferred_date TEXT;
ALTER TABLE leads ADD COLUMN preferred_time_window TEXT;
ALTER TABLE leads ADD COLUMN timezone TEXT;
ALTER TABLE leads ADD COLUMN consent_given INTEGER NOT NULL DEFAULT 0 CHECK (consent_given IN (0, 1));
ALTER TABLE leads ADD COLUMN consent_version TEXT;
ALTER TABLE leads ADD COLUMN consented_at INTEGER;
ALTER TABLE leads ADD COLUMN clickup_task_id TEXT;
ALTER TABLE leads ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'not_applicable'
  CHECK (delivery_status IN (
    'not_applicable', 'pending', 'processing', 'retryable_failure',
    'forwarded', 'final_failure', 'needs_reconciliation'
  ));
-- D1/SQLite cannot add a non-constant default to a populated table.
ALTER TABLE leads ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;

UPDATE leads SET updated_at = created_at WHERE updated_at = 0;

CREATE UNIQUE INDEX IF NOT EXISTS leads_request_id_unique_idx
  ON leads (request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_delivery_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'clickup' CHECK (provider IN ('clickup')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'processing', 'retryable_failure', 'delivered',
      'final_failure', 'needs_reconciliation'
    )),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_attempt_at INTEGER,
  last_error_code TEXT,
  external_id TEXT,
  claim_token TEXT,
  lease_expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (lead_id, provider)
);

CREATE INDEX IF NOT EXISTS lead_delivery_due_idx
  ON lead_delivery_outbox (status, next_attempt_at, attempt_count);

CREATE INDEX IF NOT EXISTS lead_delivery_claim_idx
  ON lead_delivery_outbox (claim_token);
