-- Backfill the seeded Tofu row to align with HCSP 2020 / ANSES guidance
-- discouraging soja products before 3 ans. Existing self-hosted DBs were
-- seeded with Tofu at suggested_age_months = 6; this raises it to 36 to
-- match FORBIDDEN_FOODS[sojaboisson-3ans] and the updated soja card.
--
-- Idempotent: only updates the built-in seeded row (is_custom = 0) that
-- still holds the old value, so re-running the migration is a no-op and
-- a self-hosted operator who deliberately set a different age is left
-- alone.
UPDATE foods
SET suggested_age_months = 36
WHERE name = 'Tofu'
  AND category = 'legumineuses'
  AND allergen_type = 'soja'
  AND is_custom = 0
  AND suggested_age_months = 6;
