import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  // No globalSetup: Playwright invokes globalSetup AFTER the webServer boots,
  // so a reset there would clobber the migrations the webServer just applied.
  // Tests assume a fresh database — `bun run test:e2e` deletes the throwaway
  // SQLite file (scripts/reset-e2e-db.ts) before invoking Playwright.
  fullyParallel: false,
  // Two workers: one per project, so desktop and mobile run in parallel.
  // `fullyParallel: false` keeps tests within a project serial (one user per
  // test, shared SQLite DB). The two streams share one webServer + bun:sqlite
  // connection; a rare cross-stream stall on the child-creation redirect is
  // mitigated by the E2E argon2id relax (src/lib/server/auth.ts, gated on E2E=1,
  // which drops signup CPU cost ~10x) plus the 15s URL-assertion timeouts in
  // e2e/_helpers.ts. (Serializing to `workers: 1` was tried — it doesn't help,
  // because the rare stalls are server-load-driven, not write-lock contention —
  // and it roughly doubles wall-clock, so we keep parallelism.)
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Disable view transitions across the suite. The root +layout.svelte
    // gates `document.startViewTransition` on a `prefers-reduced-motion:
    // reduce` check ; setting this here makes every browser context honour
    // that gate, so navigation between bento tabs doesn't hide source
    // elements behind `visibility: hidden` mid-transition (which causes
    // elementFromPoint to return whatever sits underneath, like an h2 in
    // main intercepting clicks on a fixed bottom-nav link).
    reducedMotion: 'reduce'
  },
  projects: [
    {
      // Default project — runs every untagged spec at desktop viewport.
      // The negative-lookahead grep excludes specs explicitly tagged
      // @mobile-only (drag gestures, mobile-keyboard interactions).
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      grep: /^(?!.*@mobile-only).*$/s
    },
    {
      // Mobile project — runs only specs tagged @responsive or @mobile-only.
      // iPhone 14 (390 × 664 viewport — the 844px figure is the screen size ;
      // Playwright's device descriptor subtracts a Safari chrome offset for
      // the visible viewport) is below Tailwind's md breakpoint (768px) so
      // side="auto" modals resolve to bottom-sheet behaviour.
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        // Force chromium — iPhone devices default to webkit, but the signup
        // helper has a pre-existing WebKit incompatibility. Use Chromium with
        // iPhone 14's viewport / UA / touch settings to exercise the mobile
        // breakpoint without the WebKit baggage.
        browserName: 'chromium'
      },
      grep: /@responsive|@mobile-only/
    }
    // WebKit is intentionally avoided across both projects: the signup helper
    // does not complete the post-signup redirect on Safari (pre-existing
    // helper incompatibility). The mobile project exercises an iPhone 14
    // viewport via Chromium instead. `@media print` is engine-equivalent
    // across modern browsers; the Chromium pass covers the print stylesheet.
  ],
  webServer: {
    // E2E runs against a throwaway SQLite file at DATABASE_PATH. The app applies
    // migrations + seeds the catalog on boot; scripts/reset-e2e-db.ts deletes
    // the file before the suite runs (test:e2e). No external DB service needed.
    command: `bun run build && PORT=${PORT} HOST=127.0.0.1 ORIGIN=${BASE_URL} bun build/index.js`,
    port: PORT,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'production',
      DATABASE_PATH: process.env.DATABASE_PATH ?? './e2e-test.db',
      // Marks this server as an end-to-end run so the signup throttle relaxes
      // its 20/hr cap — a single Playwright suite legitimately creates dozens
      // of accounts from one address, and we'd otherwise lock ourselves out.
      E2E: '1'
    }
  }
});
