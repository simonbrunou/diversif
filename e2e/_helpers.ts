import { expect, test, type Page } from '@playwright/test';

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
  // Bumped from the 5s default : with workers:2 the signup action contends
  // with parallel-project requests on a shared Postgres, and a slow CI
  // runner can push the POST + 303-follow over 5s. Keep the assertion
  // bounded so a genuinely stuck redirect still fails, just not flakily.
  await expect(page).toHaveURL(/\/child\/new/, { timeout: 15_000 });
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

  // Values typed into the SSR'd form before hydration finishes can be lost
  // when the client render replaces the inputs, so the submit then posts an
  // empty form. Fill, then require the values to be observed intact on a
  // LATER toPass attempt. This greatly narrows (does not fully close) the
  // race — hydration landing after the second read can still clobber — but
  // the form also echoes values back on failure now, so a residual loss
  // surfaces as a visible 400 rather than silent data loss.
  const nameInput = page.getByLabel('Prénom');
  const birthInput = page.getByLabel('Date de naissance');
  let filledOnce = false;
  await expect(async () => {
    const intact =
      (await nameInput.inputValue()) === name && (await birthInput.inputValue()) === birthDate;
    if (intact && filledOnce) return;
    await nameInput.fill(name);
    await birthInput.fill(birthDate);
    filledOnce = true;
    throw new Error('waiting for the filled values to survive a re-check');
  }).toPass({ timeout: 15_000 });
  await page.getByRole('button', { name: /^créer$/i }).click();
  // Same 15s bump as the signup-step assertion : the /child/new action
  // inserts a child + a membership and redirects to /child/<id>, which
  // can exceed the 5s default under workers:2 contention on a shared
  // Postgres in CI.
  await expect(page).toHaveURL(/\/child\/\d+$/, { timeout: 15_000 });

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
  // The dialog mounts client-side after hydration, so an instantaneous
  // isVisible() races it : the check returns false, dismissal is skipped, and
  // the dialog opens mid-test — polluting later assertions and axe sweeps
  // (which then scan its entry animation and report blended-opacity contrast
  // failures). Give it a short window to appear before concluding absence;
  // only a timeout means absence — anything else (page closed, strict-mode
  // violation) is a real failure that must surface here, not three steps later.
  const appeared = await dismiss
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch((e: Error) => {
      if (e.name === 'TimeoutError') return false;
      throw e;
    });
  if (appeared) {
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

/**
 * Project-aware dialog placement assertion: bottom-sheet on the `mobile`
 * project, anything-else on the `desktop` project. Use when both projects
 * exercise the same dialog and we just want to lock that the resolved side
 * matches the current viewport.
 */
export async function expectDialogMatchesViewport(page: Page): Promise<void> {
  if (test.info().project.name === 'mobile') {
    await expectBottomSheet(page);
  } else {
    await expectNotBottomSheet(page);
  }
}
