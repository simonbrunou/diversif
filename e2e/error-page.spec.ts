import { expect, test } from '@playwright/test';
import { awaitHydration } from './_helpers';

// An address no route matches gets SvelteKit's own 404, which the server
// hook answers with a localized description in the URL's language. Before
// #650 it answered with SvelteKit's English "Internal Error", which also
// said the server failed when the page simply does not exist.
for (const { path, lang, title, description, reference } of [
  {
    path: '/nope',
    lang: 'fr',
    title: 'Page introuvable',
    description: 'Aucune page ne correspond à cette adresse.',
    reference: /^Erreur 404 · Réf : [0-9a-f]{8}$/
  },
  {
    path: '/en/nope',
    lang: 'en',
    title: 'Page not found',
    description: 'No page matches this address.',
    reference: /^Error 404 · Ref: [0-9a-f]{8}$/
  }
]) {
  test(`an unknown address shows a ${lang} 404 description and its reference`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await awaitHydration(page);

    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const heading = page.getByRole('heading', { level: 1, name: title });
    await expect(heading).toBeVisible();
    await expect(heading.locator('xpath=following-sibling::p[1]')).toHaveText(description);
    await expect(heading.locator('xpath=following-sibling::p[2]')).toHaveText(reference);
    // The serialized error SvelteKit embeds for hydration too.
    expect(await page.content()).not.toContain('Internal Error');
  });
}
