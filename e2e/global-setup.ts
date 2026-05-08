import pg from 'pg';

// Wipe the e2e Postgres before every run so tests start from an empty DB —
// the adapter-node server boot will then re-run migrations and re-seed the
// food catalog. Targets E2E_DATABASE_URL only; ordinary DATABASE_URL is the
// app's regular dev/prod connection and must never be touched here.
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      'E2E_DATABASE_URL is required for the playwright suite (a throwaway pg the run can drop).'
    );
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.end();
}
