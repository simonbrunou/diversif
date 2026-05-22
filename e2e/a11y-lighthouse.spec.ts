import { test, type Page } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

/**
 * Lighthouse audit sweep — runs in the dedicated `lighthouse` Playwright
 * project (CDP port 9222). Same route set as a11y-axe.
 *
 * Phase 1 ships with thresholds set to 0 (soft — Lighthouse still
 * collects category scores and writes HTML/JSON reports, but the test
 * passes regardless). Phase 2's final commit raises the thresholds to:
 *   accessibility: 95, best-practices: 95, seo: 95, performance: 0
 * Performance stays at 0 — Bundle D will set the perf budget.
 */

const SOFT_THRESHOLDS = {
  accessibility: 0,
  'best-practices': 0,
  seo: 0,
  performance: 0
};

const REPORTS_DIR = 'lighthouse-reports';

function reportName(route: string): string {
  const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  return slug || 'root';
}

async function lighthouseAudit(page: Page, route: string): Promise<void> {
  // Wait until network is idle before launching Lighthouse — without this
  // playAudit() races SvelteKit's hydration and Lighthouse occasionally
  // misses the First Contentful Paint signal, returning null category scores.
  await page.waitForLoadState('networkidle');
  await playAudit({
    page,
    thresholds: SOFT_THRESHOLDS,
    port: 9222,
    reports: {
      formats: { html: true, json: true },
      name: reportName(route),
      directory: REPORTS_DIR
    }
  });
}

// playAudit() takes 20-60s per route (Lighthouse runs a full audit pass
// including a perf trace). The global 30s timeout from playwright.config.ts
// would kill it before report write. Per-test timeout overrides below.
const SINGLE_AUDIT_TIMEOUT = 180_000;
const AUTH_WALKER_TIMEOUT = 14 * SINGLE_AUDIT_TIMEOUT;

const PUBLIC_ROUTES = [
  '/',
  '/signup',
  '/login',
  '/cgu',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cookies',
  '/sources',
  '/offline'
];

for (const route of PUBLIC_ROUTES) {
  test(`lighthouse: ${route} @lighthouse`, async ({ page }) => {
    test.setTimeout(SINGLE_AUDIT_TIMEOUT);
    await page.goto(route);
    await lighthouseAudit(page, route);
  });
}

test.describe('lighthouse — auth routes @lighthouse', () => {
  test('walks the signed-in surface', async ({ page }) => {
    test.setTimeout(AUTH_WALKER_TIMEOUT);
    const childId = await signUpAndCreateChild(page, 'A11yLH', '2025-08-01');
    await dismissWelcomeIfPresent(page);

    const routes = [
      '/account',
      '/account/profile',
      '/account/sessions',
      '/account/theme',
      '/account/delete',
      '/child/new',
      `/child/${childId}`,
      `/child/${childId}/foods`,
      `/child/${childId}/foods?segment=allergens`,
      `/child/${childId}/foods?segment=categories`,
      `/child/${childId}/foods?segment=bilan`,
      `/child/${childId}/guide`,
      `/child/${childId}/log`,
      `/child/${childId}/report`
    ];

    for (const r of routes) {
      await test.step(`lighthouse ${r}`, async () => {
        await page.goto(r);
        await lighthouseAudit(page, r);
      });
    }
  });
});
