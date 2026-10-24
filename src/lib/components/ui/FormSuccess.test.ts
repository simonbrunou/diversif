import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import FormSuccess from './FormSuccess.svelte';

afterEach(() => cleanup());

describe('FormSuccess', () => {
  it('keeps an empty status region mounted while the action returned no key', () => {
    render(FormSuccess, { props: { messageKey: undefined, form: null } });
    expect(screen.getByRole('status').textContent?.trim()).toBe('');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('resolves a known key to its message in a success callout', () => {
    const form = { savedKey: 'errorsAccountPasswordSuccess' };
    render(FormSuccess, { props: { messageKey: form.savedKey, form } });
    expect(screen.getByRole('status').textContent?.trim()).toBe('Mot de passe modifié.');
    expect(screen.getByRole('note').className).toContain('bg-tile-mint');
  });

  it('falls back to the generic message for an unknown key', () => {
    const form = { savedKey: 'notAMessageKey' };
    render(FormSuccess, { props: { messageKey: form.savedKey, form } });
    expect(screen.getByRole('status').textContent?.trim()).toBe('Une erreur s’est produite.');
  });

  it('puts the class on the callout, so an empty region takes no room', async () => {
    const { rerender } = render(FormSuccess, {
      props: { messageKey: undefined, form: null, class: 'mb-4' }
    });
    expect(screen.getByRole('status').className).not.toContain('mb-4');
    const form = { savedKey: 'errorsAccountPasswordSuccess' };
    await rerender({ messageKey: form.savedKey, form, class: 'mb-4' });
    expect(screen.getByRole('status').className).not.toContain('mb-4');
    expect(screen.getByRole('note').className).toContain('mb-4');
  });

  // Screen readers announce a change inside a live region that already
  // exists, not reliably a role="status" inserted along with its text.
  it('keeps the status region and swaps its callout for each new result', async () => {
    const saved = { savedKey: 'errorsAccountPasswordSuccess' };
    const { rerender } = render(FormSuccess, {
      props: { messageKey: saved.savedKey, form: { ...saved } }
    });
    const region = screen.getByRole('status');
    const first = screen.getByRole('note');
    await rerender({ messageKey: saved.savedKey, form: { ...saved } });
    expect(screen.getByRole('status')).toBe(region);
    expect(screen.getByRole('note')).not.toBe(first);
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it('empties the region when the next result carries no success key', async () => {
    const saved = { savedKey: 'errorsAccountPasswordSuccess' };
    const { rerender } = render(FormSuccess, {
      props: { messageKey: saved.savedKey, form: saved }
    });
    const region = screen.getByRole('status');
    await rerender({ messageKey: undefined, form: { otherKey: 'errorsAuthBadInput' } });
    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent?.trim()).toBe('');
  });
});
