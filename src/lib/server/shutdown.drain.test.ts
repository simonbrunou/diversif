// Pins the pg.Pool-compatible drain semantic for Bun.SQL.end(): with no
// `timeout` option it must wait for in-flight queries to finish before
// resolving. shutdown.ts relies on this — a regression (e.g. an upstream
// Bun change, or a future driver swap) would let in-flight requests get
// abandoned during SIGTERM instead of completing cleanly.
//
// Gated on a reachable Postgres: in CI, E2E_DATABASE_URL points at the
// postgres:16 service container. Locally, falls back to the docker-compose
// dev DB. If TCP connect fails, the whole describe block skips so the
// pg-mem-only unit run on dev laptops without Postgres stays green.

import { describe, expect, it } from 'bun:test';
import net from 'node:net';
import { SQL } from 'bun';

const DB_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://diversif:diversif@localhost:5432/diversif';

async function pgReachable(url: string): Promise<boolean> {
  try {
    const { hostname, port } = new URL(url);
    return await new Promise<boolean>((resolve) => {
      const sock = net.createConnection({ host: hostname, port: Number(port) || 5432 });
      const done = (ok: boolean) => {
        sock.destroy();
        resolve(ok);
      };
      sock.once('connect', () => done(true));
      sock.once('error', () => done(false));
      setTimeout(() => done(false), 500).unref();
    });
  } catch {
    return false;
  }
}

const pgUp = await pgReachable(DB_URL);

describe.skipIf(!pgUp)('Bun.SQL drain semantic (live Postgres)', () => {
  it('sql.end() waits for an in-flight query to finish before resolving', async () => {
    const sql = new SQL({ url: DB_URL, connection: { statement_timeout: 10_000 } });
    const queryStart = performance.now();
    // bun:sql tagged-template queries are lazy: they don't dispatch until
    // .then() is attached. We attach handlers up-front so the query is in
    // flight when we call sql.end() 300ms later — otherwise end() would
    // tear down the pool BEFORE the query is ever sent, the awaited promise
    // would reject with ERR_POSTGRES_CONNECTION_CLOSED, and we'd be testing
    // nothing.
    const queryResult = sql`SELECT pg_sleep(2) AS slept, 42 AS marker`.then(
      (rows) => ({ ok: true as const, rows, ms: performance.now() - queryStart }),
      (err) => ({ ok: false as const, err: String(err), ms: performance.now() - queryStart })
    );
    await new Promise((r) => setTimeout(r, 300));
    const endStart = performance.now();
    await sql.end();
    const endMs = performance.now() - endStart;
    const result = await queryResult;
    // end() must NOT return immediately (~300ms after kickoff) — it must
    // hold until pg_sleep(2) completes (~1.7s remaining). 1000ms floor is
    // generous against scheduler noise on slow CI runners.
    expect(endMs).toBeGreaterThan(1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ms).toBeGreaterThan(1800);
      expect(result.rows[0]?.marker).toBe(42);
    }
  }, 15_000);
});
