#!/usr/bin/env bun
/**
 * Delete the throwaway E2E SQLite database so the next `bun run test:e2e`
 * starts from an empty database. The Playwright webServer recreates the file
 * and runs migrations + seed on boot.
 *
 * Why this exists: Playwright invokes `globalSetup` AFTER the webServer is up,
 * so a reset there would clobber the migrations the webServer just applied. We
 * reset before invoking Playwright instead. In CI each runner is fresh, so the
 * file doesn't exist yet and this is a harmless no-op.
 */
import { rmSync } from 'node:fs';

const path = process.env.DATABASE_PATH ?? './e2e-test.db';
for (const f of [path, `${path}-wal`, `${path}-shm`, `${path}-journal`]) {
  rmSync(f, { force: true });
}
console.log('Reset E2E SQLite at', path);
