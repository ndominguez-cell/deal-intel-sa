-- Database-configurable vehicle targets. When empty, the pipeline
-- falls back to the hardcoded TARGET_VEHICLES in server/sources/types.ts.
CREATE TABLE IF NOT EXISTS vehicle_targets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  make        TEXT NOT NULL,
  model       TEXT NOT NULL,
  year_min    INTEGER DEFAULT 2020,
  price_max   INTEGER DEFAULT 35000,
  mileage_max INTEGER DEFAULT 90000,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_targets_make_model_unique
  ON vehicle_targets (lower(make), lower(model));

INSERT OR IGNORE INTO vehicle_targets (make, model)
VALUES
  ('Ford',       'F-150'),
  ('Chevrolet',  'Silverado 1500');
