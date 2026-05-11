// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReminderStrip from './ReminderStrip.svelte';

afterEach(() => cleanup());

describe('ReminderStrip', () => {
  it('renders nothing when reminders is empty', () => {
    const { container } = render(ReminderStrip, { props: { reminders: [] } });
    expect(container.textContent?.trim() ?? '').toBe('');
  });

  it('renders title + body of the first reminder', () => {
    render(ReminderStrip, {
      props: {
        reminders: [
          {
            key: 'r1',
            severity: 'warn',
            title: 'Surveiller la réaction',
            body: 'Réaction observée il y a 30 min — encore 30 min à surveiller.',
            dismissable: true
          }
        ]
      }
    });
    expect(screen.getByText('Surveiller la réaction')).toBeTruthy();
    expect(screen.getByText(/encore 30 min/)).toBeTruthy();
  });

  it('renders the cta link when provided', () => {
    render(ReminderStrip, {
      props: {
        reminders: [
          {
            key: 'r1',
            severity: 'warn',
            title: 'Ouvrir',
            body: 'corps',
            cta: { label: 'Voir le log', href: '/child/1/log/42' },
            dismissable: true
          }
        ]
      }
    });
    const link = screen.getByRole('link', { name: 'Voir le log' });
    expect(link.getAttribute('href')).toBe('/child/1/log/42');
  });
});
