-- Backfill any symptom rows whose label isn't in the closed SymptomLabel union.
-- The app has only ever inserted union members since the symptoms table was
-- introduced (migration 0004), but adding the CHECK constraint without a
-- backfill would fail on any operator-inserted or hand-modified row.
-- Convert orphans to 'autre' so the constraint can be enforced without
-- dropping data.
--
-- DATA SAFETY NOTE: this coerces case- or whitespace-variant labels
-- (e.g. 'Gonflement', ' rougeur ') silently to 'autre'. If you're an
-- operator with hand-edited rows and want to preserve them, run the
-- backfill manually first with explicit normalisation (LOWER/TRIM) and
-- review the affected rows before applying this migration.
UPDATE "symptoms"
SET "label" = 'autre'
WHERE "label" NOT IN (
  'rougeur',
  'urticaire',
  'eczema',
  'vomissement',
  'diarrhee',
  'gonflement',
  'toux',
  'detresse-respiratoire',
  'levres-bleues',
  'autre'
);
--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_label_check" CHECK ("symptoms"."label" in ('rougeur', 'urticaire', 'eczema', 'vomissement', 'diarrhee', 'gonflement', 'toux', 'detresse-respiratoire', 'levres-bleues', 'autre'));
