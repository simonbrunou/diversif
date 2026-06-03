ALTER TABLE `children` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `food_entries` ADD `updated_at` integer;--> statement-breakpoint
-- Backfill: existing rows have never been edited since tracking began, so seed
-- updated_at from created_at rather than leaving it NULL. Idempotent (guarded by
-- IS NULL) so a re-run after a partial migration is safe.
UPDATE `children` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
UPDATE `food_entries` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
