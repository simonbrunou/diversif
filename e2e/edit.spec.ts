import { test, expect, type Page } from '@playwright/test';
import {
  awaitHydration,
  dismissWelcomeIfPresent,
  openWithoutJavaScript,
  signUpAndCreateChild
} from './_helpers';

// The edit page's four actions (update, delete, deleteMeal, removeIngredient)
// end to end, through the repas write module: one test per form mode. Then a
// reaction change that a symptom overtook (#445) and what a refused save
// keeps (#443), each with and without JavaScript.

async function childOfEightMonths(page: Page): Promise<string> {
  const birthDate = new Date();
  birthDate.setMonth(birthDate.getMonth() - 8);
  const childId = await signUpAndCreateChild(page, 'Emma', birthDate.toISOString().slice(0, 10));
  await dismissWelcomeIfPresent(page);
  return childId;
}

async function logRepas(page: Page, childId: string, aliments: string[]): Promise<void> {
  await page.goto(`/child/${childId}/log`);
  await awaitHydration(page);
  for (const name of aliments) {
    await page.getByPlaceholder('Rechercher un aliment…').fill(name);
    await page
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .first()
      .click();
  }
  await expect(page.locator('input[type="hidden"][name="foodId"]')).toHaveCount(aliments.length);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  // The dashboard strips the milestone query once it has celebrated.
  await expect(page).toHaveURL(new RegExp(`/child/${childId}(\\?.*)?$`));
}

// The id an edit link of the dashboard's recent feed points to.
async function feedEntryId(page: Page, childId: string, testId: string): Promise<string> {
  await page.goto(`/child/${childId}`);
  const href = await page.getByTestId(testId).first().getAttribute('href');
  const id = href?.match(/\/(?:foods|log)\/(\d+)/)?.[1];
  if (!id) throw new Error(`no entry link in ${href}`);
  return id;
}

function reactionOption(page: Page, name: string, value: string) {
  return page
    .locator('label')
    .filter({ has: page.locator(`input[name="${name}"][value="${value}"]`) });
}

test('edits a standalone repas and lands back on its detail page', async ({ page }) => {
  const childId = await childOfEightMonths(page);
  await logRepas(page, childId, ['Poire']);
  const entryId = await feedEntryId(page, childId, 'feed-row-detail');

  await page.goto(`/child/${childId}/log/${entryId}?from=detail`);
  await awaitHydration(page);
  await expect(page.getByRole('heading', { name: 'Modifier ce repas' })).toBeVisible();
  await reactionOption(page, 'reaction', 'inconfort').click();
  await page.getByLabel('Note').fill('A grimacé');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/foods/${entryId}$`));

  await page.goto(`/child/${childId}/log/${entryId}`);
  await awaitHydration(page);
  await expect(page.locator('input[name="reaction"][value="inconfort"]')).toBeChecked();
  await expect(page.locator('input[name="reactionLoaded"]')).toHaveValue('inconfort');
  await expect(page.getByLabel('Note')).toHaveValue('A grimacé');

  // A refused edit stays on the editor with its error (same entry: the
  // layout's per-entry key must not remount and drop the form result), and
  // writes nothing.
  await page.getByLabel('Quand ?').fill('2099-01-01T10:00');
  await page.getByLabel('Note').fill('jamais enregistré');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('La date du repas ne peut pas être dans le futur.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/log/${entryId}$`));
  await page.reload();
  await expect(page.getByLabel('Note')).toHaveValue('A grimacé');

  await page.getByRole('button', { name: 'Supprimer ce repas', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Supprimer ce repas', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/foods$`));
  await page.goto(`/child/${childId}`);
  await expect(page.getByTestId('feed-row-detail')).toHaveCount(0);
});

test('edits a meal, removes aliments, then deletes the meal', async ({ page }) => {
  const childId = await childOfEightMonths(page);
  await logRepas(page, childId, ['Poire', 'Pomme', 'Carotte', 'Banane']);
  // The dashboard opens a meal on its lowest entry id: Poire's.
  const anchorId = await feedEntryId(page, childId, 'feed-row-edit');

  await page.goto(`/child/${childId}/log/${anchorId}?from=dashboard`);
  await awaitHydration(page);
  await expect(page.getByRole('heading', { name: 'Modifier le repas' })).toBeVisible();
  const remove = page.getByRole('button', { name: 'Retirer', exact: true });
  await expect(remove).toHaveCount(4);
  await page.getByLabel('Note').fill('Repas du midi');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}$`));

  await page.goto(`/child/${childId}/log/${anchorId}`);
  await awaitHydration(page);
  await expect(page.getByLabel('Note')).toHaveValue('Repas du midi');
  const dialog = page.getByRole('dialog');
  const removeConfirmed = async (row: number) => {
    await remove.nth(row).click();
    await expect(dialog).toContainText('du repas ?');
    await dialog.getByRole('button', { name: 'Retirer', exact: true }).click();
  };

  // Another aliment: the editor lands back on the same entry, and must show
  // the meal as it is now, with the dialog closed.
  await removeConfirmed(1);
  await expect(remove).toHaveCount(3);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('link', { name: 'Pomme' })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/log/${anchorId}$`));

  // The aliment the editor was opened on: it lands on a survivor.
  await removeConfirmed(0);
  await expect(page).not.toHaveURL(new RegExp(`/log/${anchorId}$`));
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/log/\\d+$`));
  await expect(remove).toHaveCount(2);
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Supprimer le repas', exact: true }).click();
  const deleteDialog = page.getByRole('dialog');
  await deleteDialog.getByRole('button', { name: 'Supprimer le repas', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}/foods$`));
  await page.goto(`/child/${childId}`);
  await expect(page.getByTestId('feed-row-edit')).toHaveCount(0);
});

// #445: a severe symptom, added from another tab, promotes the repas to
// « Réaction marquée » while the editor still shows it RAS. A less severe pick
// is refused with a message, and the editor shows the stored reaction, so the
// save that follows goes through. With JavaScript the refusal applies in
// place and keeps the note; without it SvelteKit renders the page again from
// `load`.
for (const javaScript of [true, false]) {
  test(`refuses a reaction change that a symptom overtook, then saves, ${javaScript ? 'with' : 'without'} JavaScript`, async ({
    browser,
    page
  }) => {
    // 2.0 to 2.2 s locally, against 1.6 to 1.8 s for the refused-save tests
    // below, which took up to 29 s on a CI runner shared with other jobs.
    test.slow();
    const childId = await childOfEightMonths(page);
    await logRepas(page, childId, ['Poire']);
    const entryId = await feedEntryId(page, childId, 'feed-row-detail');
    const editor = javaScript ? page : await openWithoutJavaScript(browser, page);
    try {
      await editor.goto(`/child/${childId}/log/${entryId}?from=detail`);
      if (javaScript) await awaitHydration(editor);
      await expect(editor.locator('input[name="reactionLoaded"]')).toHaveValue('ras');

      // A second tab of the same context, like a co-parent's: no cold start.
      const other = await page.context().newPage();
      try {
        await other.goto(`/child/${childId}/foods/${entryId}`);
        await awaitHydration(other);
        await other.getByRole('button', { name: 'Signaler une réaction tardive' }).click();
        await reactionOption(other, 'label', 'gonflement').click();
        await other.getByRole('button', { name: 'Enregistrer le symptôme' }).click();
        await expect(other.getByRole('dialog')).toBeHidden();
      } finally {
        await other.close();
      }

      const note = editor.getByLabel('Note');
      await reactionOption(editor, 'reaction', 'inconfort').click();
      await note.fill('A grimacé');
      const save = editor.getByRole('button', { name: 'Enregistrer', exact: true });
      await save.click();
      await expect(editor.getByRole('alert')).toHaveText(
        'Une réaction a changé entre-temps, par exemple après l’ajout d’un symptôme : vérifiez-la avant d’enregistrer.'
      );
      await expect(editor.locator('input[name="reaction"][value="reaction"]')).toBeChecked();
      await expect(editor.locator('input[name="reactionLoaded"]')).toHaveValue('reaction');
      if (javaScript) {
        await expect(note).toHaveValue('A grimacé');
      } else {
        // Nothing was saved: `load` renders the stored, empty note.
        await expect(note).toHaveValue('');
        await note.fill('A grimacé');
      }

      await save.click();
      await expect(editor).toHaveURL(new RegExp(`/child/${childId}/foods/${entryId}$`));
      await editor.goto(`/child/${childId}/log/${entryId}`);
      await expect(editor.locator('input[name="reaction"][value="reaction"]')).toBeChecked();
      await expect(note).toHaveValue('A grimacé');
    } finally {
      if (editor !== page) await editor.context().close();
    }
  });
}

// A datetime-local value `days` back at 10:00, in the test runner's local
// time. The browser shares that zone; without JavaScript the server parses the
// value in its own. A few days back falls between the birth day and now in
// any zone.
function daysAgoInput(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

// Where a save goes back to, for each `from` the editor can be opened with.
const ORIGINS = [
  {
    from: 'detail',
    landsAt: (childId: string, entryId: string) => new RegExp(`/child/${childId}/foods/${entryId}$`)
  },
  { from: 'dashboard', landsAt: (childId: string) => new RegExp(`/child/${childId}$`) }
] as const;

const FORM_MODES = [
  { name: 'standalone repas', aliments: ['Poire'], feedRow: 'feed-row-detail' },
  { name: 'meal', aliments: ['Poire', 'Pomme'], feedRow: 'feed-row-edit' }
] as const;

// #443: a refused save keeps where the editor was opened from, so the save
// that follows goes back there. With JavaScript the refusal applies in place;
// without it the browser posts to the form's action URL and SvelteKit renders
// the refusal there, so that URL must carry `from`.
for (const javaScript of [true, false]) {
  test.describe(`a refused save ${javaScript ? 'with' : 'without'} JavaScript`, () => {
    for (const mode of FORM_MODES) {
      for (const { from, landsAt } of ORIGINS) {
        test(`the ${mode.name} editor opened from ${from} saves back there`, async ({
          browser,
          page
        }) => {
          // A signup, a logged repas, then the edit itself: up to 29 s of the
          // 30 s budget on a CI runner shared with other jobs. test.slow()
          // triples the budget for these tests only.
          test.slow();
          const childId = await childOfEightMonths(page);
          await logRepas(page, childId, [...mode.aliments]);
          const entryId = await feedEntryId(page, childId, mode.feedRow);
          // With JavaScript the editor opens on the page that logged the repas,
          // as the tests above do. A fresh context would load every chunk again
          // and install the service worker, which precaches the app: extra
          // work on a runner that is already slow.
          const editor = javaScript ? page : await openWithoutJavaScript(browser, page);
          try {
            await editor.goto(`/child/${childId}/log/${entryId}?from=${from}`);
            if (javaScript) await awaitHydration(editor);
            const save = editor.getByRole('button', { name: 'Enregistrer', exact: true });

            await editor.getByLabel('Quand ?').fill('2099-01-01T10:00');
            await save.click();
            await expect(
              editor.getByText('La date du repas ne peut pas être dans le futur.')
            ).toBeVisible();
            await expect(editor.locator('form[action^="?/update"] input[name="from"]')).toHaveValue(
              from
            );

            await editor.getByLabel('Quand ?').fill(daysAgoInput(3));
            await save.click();
            await expect(editor).toHaveURL(landsAt(childId, entryId));
          } finally {
            if (editor !== page) await editor.context().close();
          }
        });
      }
    }
  });
}
