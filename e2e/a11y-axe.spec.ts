import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dismissWelcomeIfPresent, signUpAndCreateChild } from './_helpers';

/**
 * a11y axe sweep — runs WCAG 2.1 AA + best-practice rules against every
 * public and auth-required route. Tagged @responsive so both the desktop
 * and mobile Playwright projects pick it up; auth routes share one signup
 * per worker via test.step for speed.
 *
 * Hard gate: any violation fails the test. The companion Lighthouse layer
 * (a11y/best-practices/SEO scores) was deferred — see the spec doc's
 * "Status" section for the playwright-lighthouse NO_FCP backstory.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

type AxeViolation = {
  id: string;
  impact: string | null | undefined;
  description: string;
  nodes: { target: string[]; failureSummary?: string }[];
};

function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return 'no violations';
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => `      ${n.target.join(' ')}\n      ${n.failureSummary ?? ''}`)
        .join('\n');
      const more = v.nodes.length > 3 ? `\n      (+${v.nodes.length - 3} more nodes)` : '';
      return `  [${v.impact ?? 'minor'}] ${v.id} — ${v.description}\n${nodes}${more}`;
    })
    .join('\n');
}

async function axeSweep(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(result.violations, formatViolations(result.violations as AxeViolation[])).toEqual([]);
}

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
  test(`a11y axe: ${route} @responsive`, async ({ page }) => {
    await page.goto(route);
    await axeSweep(page);
  });
}

test.describe('a11y axe — auth routes @responsive', () => {
  test('walks the signed-in surface', async ({ page }) => {
    const childId = await signUpAndCreateChild(page, 'A11y', '2025-08-01');
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
      await test.step(`axe ${r}`, async () => {
        await page.goto(r);
        await axeSweep(page);
      });
    }
  });
});
