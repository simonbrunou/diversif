import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, fireEvent, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import '../../../../test/component';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';

// The last use:enhance callback that registered, so a test can play
// SvelteKit's part for a dialog: run it, then apply a result through
// `update`. The page's two enhanced forms register at mount, and a dialog's
// form registers once its opener is clicked, so after a click it holds the
// dialog's.
type Submit = (input: {
  cancel: () => void;
}) => ((opts: { result: { type: string }; update: () => Promise<void> }) => Promise<void>) | void;
let enhancedSubmit: Submit | undefined;
mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/child/7/settings') } }));
mock.module('$app/forms', () => ({
  enhance: (_form: HTMLFormElement, submit: Submit) => {
    enhancedSubmit = submit;
    return { destroy: () => {} };
  }
}));
mock.module('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
mock.module('$app/env', () => ({ browser: false }));
// The page renders its results inline; a toast would show them a second time.
const toast = { error: mock(), success: mock() };
mock.module('svelte-sonner', () => ({ toast }));

import type { ActionData, PageData } from './$types';

// Static imports would hoist past mock.module, so Page is imported after the
// mocks above.
const { default: Page } = await import('./+page.svelte');

afterEach(() => {
  toast.error.mockClear();
  toast.success.mockClear();
  enhancedSubmit = undefined;
  overwriteGetLocale(() => baseLocale);
});

const data = {
  child: { id: 7, name: 'Lulu', birthDate: '2026-03-01' },
  role: 'owner',
  members: [
    {
      userId: 1,
      role: 'owner',
      displayName: 'Camille',
      email: 'camille@example.com',
      createdAt: 0
    },
    { userId: 2, role: 'member', displayName: 'Sacha', email: 'sacha@example.com', createdAt: 0 }
  ],
  invitations: [{ code: 'BEBE-ABCDEF', expiresAt: Date.UTC(2026, 11, 1) }],
  dietaryExclusions: []
} as unknown as PageData;

function renderPage(form: ActionData = null) {
  return render(Page, { props: { data, form } });
}

// The Card that holds the section's heading.
function section(view: ReturnType<typeof renderPage>, heading: string): HTMLElement {
  const card = view.getByRole('heading', { name: heading }).parentElement;
  if (!card) throw new Error(`no card around « ${heading} »`);
  return card;
}

describe('child settings messages after a page load', () => {
  it('renders a refused child update in the Informations card, without a toast', () => {
    const view = renderPage({ childErrorKey: 'errorsAuthBadInput' });
    const alert = view.getByRole('alert');
    expect(alert.textContent).toContain('Champs invalides.');
    expect(section(view, 'Informations').contains(alert)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('renders a refused revocation in the invitation card, without a toast', () => {
    const view = renderPage({ invitationErrorKey: 'errorsSettingsInviteCodeMissing' });
    const alert = view.getByRole('alert');
    expect(alert.textContent).toContain('Code manquant.');
    expect(section(view, 'Inviter quelqu’un').contains(alert)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([
    [{ childSuccessKey: 'errorsSettingsChildSuccess' }, 'Enfant mis à jour.', 'Informations'],
    [
      { dietSuccessKey: 'errorsSettingsDietSuccess' },
      'Régime alimentaire mis à jour.',
      'Régime alimentaire'
    ],
    [
      { invitationSuccessKey: 'errorsSettingsInviteRevokedSuccess' },
      'Invitation révoquée.',
      'Inviter quelqu’un'
    ],
    [
      { invitationSuccessKey: 'errorsSettingsInviteCreatedSuccess', code: 'BEBE-ABCDEF' },
      'Code généré.',
      'Inviter quelqu’un'
    ],
    [{ memberSuccessKey: 'errorsSettingsMemberRemovedSuccess' }, 'Membre retiré.', 'Membres']
  ])('renders %o once, in its own card, without a toast', (form, text, heading) => {
    const view = renderPage(form as ActionData);
    const shown = view.getAllByText(text, { exact: true });
    expect(shown).toHaveLength(1);
    expect(section(view, heading).contains(shown[0])).toBe(true);
    expect(shown[0].closest('[role="status"]')).not.toBeNull();
    expect(view.queryByRole('alert')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('renders no message before any submission', () => {
    const view = renderPage();
    expect(view.queryByRole('alert')).toBeNull();
    for (const region of view.getAllByRole('status')) {
      expect(region.textContent?.trim()).toBe('');
    }
  });

  it('replaces one section’s result with the next one', async () => {
    const view = renderPage({ childSuccessKey: 'errorsSettingsChildSuccess' });
    await view.rerender({ form: { dietSuccessKey: 'errorsSettingsDietSuccess' } });
    expect(view.queryByText('Enfant mis à jour.', { exact: true })).toBeNull();
    const diet = view.getByText('Régime alimentaire mis à jour.', { exact: true });
    expect(section(view, 'Régime alimentaire').contains(diet)).toBe(true);
  });
});

// Clicks the page button that opens a dialog, then submits the dialog the way
// SvelteKit's enhance does: `update` applies the result to the page's `form`
// prop.
async function submitDialog(
  view: ReturnType<typeof renderPage>,
  opener: string,
  result: { type: 'success' | 'failure'; data: ActionData }
) {
  enhancedSubmit = undefined;
  await fireEvent.click(view.getAllByRole('button', { name: opener })[0]);
  const settle = enhancedSubmit?.({ cancel: () => {} });
  if (!settle) throw new Error(`the « ${opener} » dialog did not register use:enhance`);
  await settle({ result, update: () => view.rerender({ form: result.data }) });
  await tick();
}

describe('child settings dialogs', () => {
  it.each([
    ['Générer un code', 'errorsAccountPasswordIncorrect', 'Mot de passe actuel incorrect.'],
    ['Générer un code', 'errorsSettingsInviteCapReached', 'Trop d’invitations actives'],
    ['Retirer', 'errorsSettingsMemberSelfRemoval', 'Vous ne pouvez pas vous retirer vous-même.'],
    ['Supprimer cet enfant', 'errorsSettingsDeleteConfirmMismatch', 'Saisissez le prénom exact']
  ])(
    'shows a « %s » refusal inside the open dialog only, and drops it on Cancel',
    async (opener, errorKey, text) => {
      const view = renderPage();
      await submitDialog(view, opener, { type: 'failure', data: { errorKey } as ActionData });
      const dialog = view.getByRole('dialog');
      const alerts = view.getAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(dialog.contains(alerts[0])).toBe(true);
      expect(alerts[0].textContent).toContain(text);
      expect(toast.error).not.toHaveBeenCalled();

      await fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
      await tick();
      expect(view.queryByRole('alert')).toBeNull();
    }
  );

  it('replaces a loaded page refusal with the dialog’s own', async () => {
    const view = renderPage({ childErrorKey: 'errorsAuthBadInput' });
    await submitDialog(view, 'Générer un code', {
      type: 'failure',
      data: { errorKey: 'errorsAuthRateLimited' }
    });
    const alerts = view.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(view.getByRole('dialog').contains(alerts[0])).toBe(true);
    expect(alerts[0].textContent).toContain('Trop de tentatives. Réessayez plus tard.');
  });

  it('shows a generated code’s success in the invitation card once the dialog closes', async () => {
    const view = renderPage();
    await submitDialog(view, 'Générer un code', {
      type: 'success',
      data: { invitationSuccessKey: 'errorsSettingsInviteCreatedSuccess', code: 'BEBE-GHJKMN' }
    });
    const shown = view.getAllByText('Code généré.', { exact: true });
    expect(shown).toHaveLength(1);
    expect(section(view, 'Inviter quelqu’un').contains(shown[0])).toBe(true);
    expect(view.queryByRole('alert')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows a removed member’s success in the Membres card once the dialog closes', async () => {
    const view = renderPage();
    await submitDialog(view, 'Retirer', {
      type: 'success',
      data: { memberSuccessKey: 'errorsSettingsMemberRemovedSuccess' }
    });
    const shown = view.getAllByText('Membre retiré.', { exact: true });
    expect(shown).toHaveLength(1);
    expect(section(view, 'Membres').contains(shown[0])).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('child settings messages in English', () => {
  it.each([
    [{ childSuccessKey: 'errorsSettingsChildSuccess' }, 'Child updated.'],
    [{ dietSuccessKey: 'errorsSettingsDietSuccess' }, 'Diet updated.'],
    [{ invitationSuccessKey: 'errorsSettingsInviteCreatedSuccess' }, 'Code generated.'],
    [{ invitationSuccessKey: 'errorsSettingsInviteRevokedSuccess' }, 'Invitation revoked.'],
    [{ memberSuccessKey: 'errorsSettingsMemberRemovedSuccess' }, 'Member removed.']
  ])('renders %o in English', (form, text) => {
    overwriteGetLocale(() => 'en');
    const view = renderPage(form as ActionData);
    expect(view.getAllByText(text, { exact: true })).toHaveLength(1);
  });
});
