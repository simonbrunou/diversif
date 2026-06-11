import { describe, expect, it } from 'bun:test';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '../../test/app-stubs';
import '../../test/component';
import WelcomeDialog from './WelcomeDialog.svelte';

describe('WelcomeDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(WelcomeDialog, {
      props: { open: false, childId: 1, formAction: '?/dismissReminder' }
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens on step 0 by default with the welcome heading', () => {
    render(WelcomeDialog, {
      props: { open: true, childId: 1, formAction: '?/dismissReminder' }
    });
    expect(screen.getByText('Bienvenue dans la diversification')).toBeTruthy();
    expect(screen.getByText('Suivant')).toBeTruthy();
  });

  it('advances through the steps when "Suivant" is clicked', async () => {
    render(WelcomeDialog, {
      props: { open: true, childId: 1, formAction: '?/dismissReminder' }
    });
    await fireEvent.click(screen.getByText('Suivant'));
    expect(screen.getByText('Comment Diversif vous accompagne')).toBeTruthy();
    await fireEvent.click(screen.getByText('Suivant'));
    expect(screen.getByText('Prêt·e à explorer')).toBeTruthy();
  });

  it('renders the "Ouvrir le guide" CTA on the last step as a submit of the dismiss form', async () => {
    render(WelcomeDialog, {
      props: { open: true, childId: 9, formAction: '?/dismissReminder' }
    });
    await fireEvent.click(screen.getByText('Suivant'));
    await fireEvent.click(screen.getByText('Suivant'));
    // Not a plain link anymore: the CTA submits the welcome-dismiss form so the
    // dialog never re-opens on the next dashboard visit, then navigates to the
    // guide via the enhance callback (data-then-guide).
    const cta = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ouvrir le guide')
    );
    expect(cta).toBeTruthy();
    expect(cta?.getAttribute('type')).toBe('submit');
    expect(cta?.getAttribute('form')).toBe('welcome-dismiss-form');
    expect(cta?.getAttribute('data-then-guide')).toBe('true');
    expect(document.querySelector('form#welcome-dismiss-form')?.getAttribute('action')).toBe(
      '?/dismissReminder'
    );
  });

  it('renders the welcome-dialog dismiss form', () => {
    render(WelcomeDialog, {
      props: { open: true, childId: 1, formAction: '?/dismissReminder' }
    });
    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('?/dismissReminder');
    expect(document.querySelector('input[name="reminderKey"]')?.getAttribute('value')).toBe(
      'welcome-dialog'
    );
  });
});
