import { describe, expect, it } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import Page from './+page.svelte';
import type { ActionData, PageData } from './$types';

const data = {
  code: 'ABCD1234',
  child: { id: 1, name: 'Léa' },
  inviter: 'Camille',
  errorKey: null
} as unknown as PageData;

function renderPage(form: ActionData = null) {
  return render(Page, { props: { data, form } });
}

describe('join/[code] page', () => {
  it('renders no alert before any submission', () => {
    expect(renderPage().queryByRole('alert')).toBeNull();
  });

  it('renders a refused invitation through its message key', () => {
    const { getByRole } = renderPage({ errorKey: 'errorsAuthInvalidInviteExpired' });
    expect(getByRole('alert').textContent?.trim()).toBe('Code d’invitation introuvable ou expiré.');
  });

  it('gives the retry delay when rate-limited', () => {
    const { getByRole } = renderPage({ errorKey: 'errorsAuthRateLimited', retryAfterSeconds: 42 });
    expect(getByRole('alert').textContent?.trim()).toBe('Trop de tentatives. Réessayez dans 42 s.');
  });

  it('re-inserts the alert on a second identical refusal, so it is announced again', async () => {
    const refusal = { errorKey: 'errorsAuthInvalidInviteExpired' } as const;
    const { getByRole, getAllByRole, rerender } = renderPage({ ...refusal });
    const first = getByRole('alert');
    await rerender({ form: { ...refusal } });
    expect(getByRole('alert')).not.toBe(first);
    expect(getAllByRole('alert')).toHaveLength(1);
  });
});
