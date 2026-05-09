-- Backfill the seeded Tofu row to align with HCSP 2020 / ANSES guidance
-- discouraging soja products before 3 ans. Existing self-hosted DBs that
-- crossed the SQLite -> Postgres cutover (commit 4c97be1) carried the old
-- suggested_age_months = 6; this raises it to 36 to match
-- ALLERGEN_GUIDANCE.soja.recommendedAgeMonths and the soja card.
--
-- Idempotent: only updates the built-in seeded row (is_custom = false)
-- still holding the old value, so re-runs are no-ops and a self-hoster
-- who deliberately set a different age is left alone.
UPDATE foods
SET suggested_age_months = 36
WHERE name = 'Tofu'
  AND category = 'legumineuses'
  AND allergen_type = 'soja'
  AND is_custom = false
  AND suggested_age_months = 6;