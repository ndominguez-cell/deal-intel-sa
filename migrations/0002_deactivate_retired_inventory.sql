-- Keep the active inventory limited to the current licensed provider pipeline.
UPDATE listings
SET is_active = 0
WHERE source <> 'licensed-market';
