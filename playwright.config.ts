import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  // No globalSetup: Playwright invokes globalSetup AFTER the webServer boots,
  // so a schema reset there would clobber the migrations the webServer just
  // applied. Tests assume a fresh database — supply one via the E2E
  // postgres service in CI, or run scripts/reset-e2e-db.sh locally.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    // E2E expects a Postgres reachable via E2E_DATABASE_URL (a throwaway
    // database — the suite runs migrations on every start). Set it in CI to
    // a postgres:16-alpine service container; locally, point it at a docker
    // compose postgres or skip the suite.
    command: `npm run build && PORT=${PORT} HOST=127.0.0.1 ORIGIN=${BASE_URL} node build/index.js`,
    port: PORT,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ?? 'postgres://diversif:diversif@localhost:5432/diversif_e2e',
      // Marks this server as an end-to-end run so the signup throttle relaxes
      // its 20/hr cap — a single Playwright suite legitimately creates dozens
      // of accounts from one address, and we'd otherwise lock ourselves out.
      E2E: '1'
    }
  }
});
