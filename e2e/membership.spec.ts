import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { signUpAndCreateChild, uniqueForWorker } from './_helpers';

async function signUp(
  page: Page,
  opts: { email: string; displayName: string; inviteCode?: string }
): Promise<void> {
  const url = opts.inviteCode ? `/signup?code=${opts.inviteCode}` : '/signup';
  await page.goto(url);
  await page.getByLabel('Votre prénom').fill(opts.displayName);
  await page.getByLabel('Adresse e-mail').fill(opts.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
}

// Shared helper so the onboarding fill is hardened against the hydration
// race (see _helpers.ts) — a local fill+click copy used to flake here.
async function signUpOwnerAndCreateChild(page: Page, name: string): Promise<{ childId: number }> {
  const sevenMonthsAgo = new Date();
  sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
  const dateStr = sevenMonthsAgo.toISOString().slice(0, 10);
  const childId = Number(await signUpAndCreateChild(page, name, dateStr, 'owner'));
  return { childId };
}

async function generateInviteCode(page: Page, childId: number): Promise<string> {
  await page.goto(`/child/${childId}/settings`);
  await page.getByRole('button', { name: /générer un code/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Mot de passe').fill('hunter2-very-long');
  await dialog.getByRole('button', { name: /générer un code/i }).click();
  // The settings page renders the invitation code in a monospace block
  // (.font-mono) once the action returns.
  const codeEl = page
    .locator('.font-mono')
    .filter({ hasText: /^BEBE-/ })
    .first();
  await expect(codeEl).toBeVisible();
  const code = (await codeEl.textContent())?.trim();
  if (!code || !/^BEBE-[A-Z2-9]{6}$/.test(code)) {
    throw new Error(`Expected an invite code, got: ${JSON.stringify(code)}`);
  }
  return code;
}

test.describe('membership permissions', () => {
  test('owner invites a co-parent who joins as a member without ownership powers', async ({
    browser
  }) => {
    // Two isolated browser contexts so cookies don't bleed between users.
    const ownerCtx: BrowserContext = await browser.newContext();
    const memberCtx: BrowserContext = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const memberPage = await memberCtx.newPage();
    try {
      const { childId } = await signUpOwnerAndCreateChild(ownerPage, 'Lulu');
      const inviteCode = await generateInviteCode(ownerPage, childId);

      const memberEmail = `${uniqueForWorker('member')}@example.com`;
      await signUp(memberPage, {
        email: memberEmail,
        displayName: 'Co-parent',
        inviteCode
      });
      // Joining via invite drops the new user on the shared child's dashboard.
      await expect(memberPage).toHaveURL(new RegExp(`/child/${childId}$`));
      await expect(memberPage.locator('body')).toContainText('Lulu');

      // The member should see the settings page but not the owner-only sections
      // (informations form / generate invite / delete child).
      await memberPage.goto(`/child/${childId}/settings`);
      await expect(memberPage.locator('body')).toContainText(/membres/i);
      await expect(memberPage.getByRole('button', { name: /générer un code/i })).toHaveCount(0);
      await expect(memberPage.getByRole('button', { name: /supprimer cet enfant/i })).toHaveCount(
        0
      );
      // But the leave action is offered to non-owners.
      await expect(memberPage.getByRole('button', { name: /quitter cet enfant/i })).toBeVisible();

      // Owner removes the co-parent through the ConfirmModal (no native confirm).
      await ownerPage.goto(`/child/${childId}/settings`);
      await expect(ownerPage.locator('body')).toContainText('Co-parent');
      await ownerPage.getByRole('button', { name: /^Retirer$/ }).click();
      const dialog = ownerPage.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(/Retirer ce membre/);
      await dialog.getByRole('button', { name: /^Retirer$/ }).click();
      await expect(dialog).toBeHidden();
      await expect(ownerPage.locator('body')).not.toContainText('Co-parent');
    } finally {
      await ownerCtx.close();
      await memberCtx.close();
    }
  });
});
