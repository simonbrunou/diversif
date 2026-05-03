// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/app-stubs';
import '../../test/component';
import ReminderBanner from './ReminderBanner.svelte';
import type { Reminder } from '$lib/server/guidance/reminders';

const baseReminder: Reminder = {
  key: 'demo',
  severity: 'info',
  title: 'Hello',
  body: 'World',
  dismissable: true
};

describe('ReminderBanner', () => {
  it('renders title and body', () => {
    const { container } = render(ReminderBanner, {
      props: { reminder: baseReminder, formAction: '?/dismissReminder' }
    });
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('World');
  });

  it('renders the cta link when provided', () => {
    const { container } = render(ReminderBanner, {
      props: {
        reminder: { ...baseReminder, cta: { label: 'Go', href: '/somewhere' } },
        formAction: '?/dismissReminder'
      }
    });
    const link = Array.from(container.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/somewhere'
    );
    expect(link).toBeDefined();
    expect(link?.textContent).toContain('Go');
  });

  it('renders source citations when provided', () => {
    const { container } = render(ReminderBanner, {
      props: {
        reminder: { ...baseReminder, sources: ['spf-pnns-guide'] },
        formAction: '?/dismissReminder'
      }
    });
    expect(container.querySelector('a[target="_blank"]')).not.toBeNull();
  });

  it('renders the dismiss form when dismissable', () => {
    const { container } = render(ReminderBanner, {
      props: { reminder: baseReminder, formAction: '?/dismissReminder' }
    });
    const form = container.querySelector('form');
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post');
    expect(form?.getAttribute('action')).toBe('?/dismissReminder');
    expect(container.querySelector('input[name="reminderKey"]')?.getAttribute('value')).toBe(
      'demo'
    );
  });

  it('omits the dismiss form when not dismissable', () => {
    const { container } = render(ReminderBanner, {
      props: {
        reminder: { ...baseReminder, dismissable: false },
        formAction: '?/dismissReminder'
      }
    });
    expect(container.querySelector('form')).toBeNull();
  });

  it.each(['info', 'warn', 'important'] as const)('renders severity %s', (severity) => {
    const { container } = render(ReminderBanner, {
      props: { reminder: { ...baseReminder, severity }, formAction: '?/dismissReminder' }
    });
    expect(container.firstElementChild?.className.length).toBeGreaterThan(0);
  });
});
