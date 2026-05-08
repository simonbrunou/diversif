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
await client.query('DROP SCHEMA IF EXISTS public CASCADE');
await client.query('CREATE SCHEMA public');
await client.end();
console.log('Reset', url.replace(/:[^:@]*@/, ':***@'));
