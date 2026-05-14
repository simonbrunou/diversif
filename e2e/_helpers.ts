import { expect, type Page } from '@playwright/test';

export function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Submit the signup form with a generated email and land on /child/new.
 * Use this when you want to drive the onboarding form yourself.
 */
export async function signUp(page: Page, emailPrefix = 'bento'): Promise<string> {
  const email = `${unique(emailPrefix)}@example.com`;
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
