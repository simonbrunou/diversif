// The inline-message tests the account profile and password pages share
// (#468): an action's refusal renders in FormError (role="alert"), its success
// in FormSuccess (role="status"), with no toast either way. Each test file
// still registers its own mocks before it imports its page.

import { expect, it, type mock } from 'bun:test';

type ActionPayload = Record<string, string>;
type ToastMock = ReturnType<typeof mock>;
type View = {
  getByRole: (role: string) => HTMLElement;
  queryByRole: (role: string) => HTMLElement | null;
  rerender: (props: { form: ActionPayload }) => Promise<void>;
};

export function itShowsActionMessagesInline(opts: {
  renderPage: (form: ActionPayload | null) => View;
  toast: { error: ToastMock; success: ToastMock };
  refusal: { form: ActionPayload; text: string };
  success: { form: ActionPayload; text: string };
}) {
  const { renderPage, toast, refusal, success } = opts;

  it('renders a refusal inline, so a no-JS visitor sees why', () => {
    const { getByRole } = renderPage(refusal.form);
    expect(getByRole('alert').textContent).toContain(refusal.text);
    expect(getByRole('status').textContent?.trim()).toBe('');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('renders a success inline, without a toast', () => {
    const { getByRole, queryByRole } = renderPage(success.form);
    expect(getByRole('status').textContent).toContain(success.text);
    expect(queryByRole('alert')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows each result applied after load once, inline', async () => {
    const { getByRole, queryByRole, rerender } = renderPage(null);
    await rerender({ form: { ...refusal.form } });
    expect(getByRole('alert').textContent).toContain(refusal.text);
    await rerender({ form: { ...success.form } });
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent).toContain(success.text);
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('renders no message before any submission', () => {
    const { getByRole, queryByRole } = renderPage(null);
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent?.trim()).toBe('');
  });
}
