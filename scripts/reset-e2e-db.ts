#!/usr/bin/env node
/**
 * Drop & recreate the public schema on E2E_DATABASE_URL so the next
 * `npm run test:e2e` starts from an empty database.
 *
 * Why this exists: Playwright invokes `globalSetup` AFTER the webServer is up,
 * so a schema reset there would nuke the migrations the webServer just
 * applied. We instead reset before invoking playwright. CI gets it for free
 * via a fresh postgres service container per run; local devs run this script.
 */
import pg from 'pg';

const url = process.env.E2E_DATABASE_URL;
if (!url) {
  console.error('E2E_DATABASE_URL is required.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
// Drop both `public` (app tables) AND `drizzle` (migration journal).
// Without dropping drizzle, repeated local resets leave the journal
// untouched, so the webServer's next migration step no-ops and the
// app boots against an empty public schema — every query fails with
// "relation does not exist". CI gets a fresh container per run and
// doesn't hit this, but local devs running this script repeatedly do.
await client.query('DROP SCHEMA IF EXISTS public CASCADE');
await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
await client.query('CREATE SCHEMA public');
await client.end();
console.log('Reset', url.replace(/:[^:@]*@/, ':***@'));
