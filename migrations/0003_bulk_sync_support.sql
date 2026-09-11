-- Snapshot listing changes inside SQLite so bulk upserts stay within Worker limits.
CREATE TRIGGER IF NOT EXISTS listings_snapshot_after_insert
AFTER INSERT ON listings
BEGIN
  INSERT INTO listing_snapshots (listing_id, price, mileage, snapshot_at)
  VALUES (NEW.id, NEW.price, NEW.mileage, unixepoch());
END;

CREATE TRIGGER IF NOT EXISTS listings_snapshot_after_price_or_mileage_update
AFTER UPDATE OF price, mileage ON listings
WHEN OLD.price IS NOT NEW.price OR OLD.mileage IS NOT NEW.mileage
BEGIN
  INSERT INTO listing_snapshots (listing_id, price, mileage, snapshot_at)
  VALUES (NEW.id, NEW.price, NEW.mileage, unixepoch());
END;

CREATE UNIQUE INDEX IF NOT EXISTS market_comps_natural_idx
ON market_comps_summary (
  city,
  vehicle_segment,
  ifnull(make, ''),
  ifnull(model, '')
);
