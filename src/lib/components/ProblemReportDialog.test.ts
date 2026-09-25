import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import '../../test/component';

let reportFails = false;
const sendProblemReport = mock(async (_message: string, _tags: Record<string, string>) => {
  if (reportFails) throw new Error('offline');
});
mock.module('$lib/sentry-feedback', () => ({ sendProblemReport }));

const { default: ProblemReportDialog } = await import('./ProblemReportDialog.svelte');

beforeEach(() => {
  reportFails = false;
  sendProblemReport.mockClear();
});
afterEach(() => cleanup());

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Envoyer le signalement' }) as HTMLButtonElement;
}

describe('ProblemReportDialog', () => {
  it('keeps the send button disabled until something other than spaces is typed', async () => {
    render(ProblemReportDialog, { props: { open: true } });
    expect(submitButton().disabled).toBe(true);
    await fireEvent.input(screen.getByLabelText('Que s’est-il passé ?'), {
      target: { value: '   ' }
    });
    expect(submitButton().disabled).toBe(true);
  });

  it('sends the trimmed message with its tags and confirms it was sent', async () => {
    render(ProblemReportDialog, { props: { open: true, tags: { errorId: 'abcd1234' } } });
    await fireEvent.input(screen.getByLabelText('Que s’est-il passé ?'), {
      target: { value: '  Le bouton ne répond pas  ' }
    });
    await fireEvent.click(submitButton());

    expect(sendProblemReport).toHaveBeenCalledWith('Le bouton ne répond pas', {
      errorId: 'abcd1234'
    });
    expect((await screen.findByRole('status')).textContent).toContain(
      'Merci, votre signalement a bien été envoyé.'
    );
  });

  it('keeps the message for a retry when sending fails', async () => {
    reportFails = true;
    render(ProblemReportDialog, { props: { open: true } });
    const textarea = screen.getByLabelText('Que s’est-il passé ?') as HTMLTextAreaElement;
    await fireEvent.input(textarea, { target: { value: 'Écran blanc' } });
    await fireEvent.click(submitButton());

    expect((await screen.findByRole('alert')).textContent).toContain('L’envoi a échoué');
    expect(textarea.value).toBe('Écran blanc');
    expect(submitButton().disabled).toBe(false);
  });
});
