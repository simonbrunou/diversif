---
name: gen-test
description: Write a bun:test test for a module in diversif, matching the project's existing test style. Invoked as /gen-test <path-to-module>.
disable-model-invocation: true
---

# Generate a test (bun:test)

Tests use **`bun:test`** (not Vitest/Jest), live next to the code as `*.test.ts`, and run via `bun test` (`bun run test` wraps paraglide compile + SvelteKit sync first).

## Conventions (match these)

- Import from `bun:test`: `import { describe, it, expect } from 'bun:test';`.
- Co-locate: `foo.ts` → `foo.test.ts` in the same directory.
- Tabs for indentation (Prettier). One `describe` per exported unit; concise `it('does X', ...)` cases.
- Cover the happy path plus null/undefined/empty and boundary inputs. See `src/lib/server/idempotency.test.ts` and the `*-test-fixtures.ts` helpers (`passkeys-test-fixtures.ts`, `gdpr-test-fixtures.ts`) for the house style.
- **French UI strings**: when asserting user-facing copy, assert the exact French text — no anglicisms (CLAUDE.md hard rule).

## Database-touching modules

diversif tests run against an **in-process `bun:sqlite` `:memory:`** database (the same engine as prod) — never the dev `local.db`. Follow the existing fixture pattern: build a fresh in-memory DB and run migrations per test, resetting between tests. Lean on the `*-test-fixtures.ts` helpers rather than re-inventing setup.

## Component (.svelte) tests

Component tests must run with the browser condition: **`bun --conditions=browser test <path>`** — plain `bun test` fails them with "mount is not available on the server". Note `mockRestore()` clears `mock.calls`, so read them before restoring.

## Steps

1. Read the target module; list its exported functions and their edge cases.
2. Write `<module>.test.ts` following the conventions above.
3. Run `bun test <path>` (or `bun --conditions=browser test <path>` for components) and iterate until green. Report the result.
