-- Drop the existing text default first: Postgres refuses to auto-cast a
-- column default across types, so leaving `DEFAULT '[]'` (text) on the
-- column makes ALTER COLUMN SET DATA TYPE fail with 42804 even though
-- the row data itself casts cleanly.
ALTER TABLE "passkeys" ALTER COLUMN "transports" DROP DEFAULT;--> statement-breakpoint
-- Cast existing text values to jsonb. The column was always written via
-- JSON.stringify(transports[]), so every existing row holds a parseable
-- JSON array; the USING clause makes the cast explicit because Postgres
-- requires it whenever a column type changes.
ALTER TABLE "passkeys"
  ALTER COLUMN "transports" SET DATA TYPE jsonb USING "transports"::jsonb;--> statement-breakpoint
ALTER TABLE "passkeys" ALTER COLUMN "transports" SET DEFAULT '[]'::jsonb;