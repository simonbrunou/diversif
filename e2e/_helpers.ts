import { expect, type Page } from '@playwright/test';

export function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Like `unique()` but mixes in the Playwright worker index so two
 * projects running in parallel (e.g. desktop + mobile) can't collide
 * on the same email seed. Always includes the worker index — Playwright
 * sets TEST_WORKER_INDEX in every worker, including single-worker runs.
 */
export function uniqueForWorker(prefix: string): string {
  const w = process.env.TEST_WORKER_INDEX ?? '0';
  return `${unique(prefix)}-w${w}`;
}

/**
 * Submit the signup form with a generated email and land on /child/new.
 * Use this when you want to drive the onboarding form yourself.
 */
export async function signUp(page: Page, emailPrefix = 'bento'): Promise<string> {
  const email = `${uniqueForWorker(emailPrefix)}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/child\/new/);
  return email;
}

/**
 * Sign up a fresh parent, create the named child, return the new id
 * parsed from the resulting /child/<id> URL.
 */
export async function signUpAndCreateChild(
  page: Page,
  name: string,
  birthDate: string,
  emailPrefix = 'bento'
): Promise<string> {
  await signUp(page, emailPrefix);

  await page.getByLabel('Prénom').fill(name);
  await page.getByLabel('Date de naissance').fill(birthDate);
  await page.getByRole('button', { name: /^créer$/i }).click();
  await expect(page).toHaveURL(/\/child\/\d+$/);

  const url = page.url();
  const match = url.match(/\/child\/(\d+)$/);
  if (!match) throw new Error(`Expected /child/<id> URL, got ${url}`);
  return match[1];
}

/**
 * New accounts auto-open a 3-step welcome modal whose backdrop intercepts
 * pointer events on the bento chrome below. Dismiss it via the "Plus tard"
 * form button — that persists `showWelcomeDialog=false` for the session, so
 * subsequent navigations stay clean.
 */
export async function dismissWelcomeIfPresent(page: Page): Promise<void> {
  const dismiss = page.getByRole('button', { name: 'Plus tard' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(dismiss).not.toBeVisible();
  }
}

/**
 * Assert the visible dialog rendered as a bottom-sheet (side="bottom",
 * the resolved side of "auto" on a sub-768px viewport).
 */
export async function expectBottomSheet(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-side', 'bottom');
}

/**
 * Assert the visible dialog rendered as anything other than a bottom-sheet
 * (top / right / left / center). Use this as the desktop-side counterpart
 * of `expectBottomSheet` — the exact desktop placement is a component-level
 * decision (e.g. side="auto" resolves to "center" on md+).
 */
export async function expectNotBottomSheet(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-side', /^(top|right|left|center)$/);
}
