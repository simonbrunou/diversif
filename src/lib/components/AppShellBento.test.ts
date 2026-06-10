import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import { textSnippet } from '../../test/component';
import AppShellBento from './AppShellBento.svelte';

mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

afterEach(() => cleanup());

describe('AppShellBento', () => {
  const baseProps = {
    user: { email: 'simon.brunou@proton.me' },
    kids: [{ id: 'a', name: 'Léo', birthMonth: '2025-11-01', avatarSeed: '🌱' }],
    currentChildId: 'a',
    currentPath: '/child/a',
    children: textSnippet('PAGE')
  };

  it('renders the page content', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByText('PAGE')).toBeTruthy();
  });

  it('renders the bottom nav when in a child route', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByLabelText('Navigation principale')).toBeTruthy();
  });

  it('renders the FAB with the right aria-label', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByLabelText('Enregistrer un aliment')).toBeTruthy();
  });

  it('renders the child header pill with the current child name', () => {
    render(AppShellBento, { props: baseProps });
    // sr-only <h1> echoes the name for screen readers, so the visible pill text
    // and the announcement node both match "Léo".
    expect(screen.getAllByText('Léo').length).toBeGreaterThan(0);
  });

  it('does not render the FAB or tab bar on auth/landing routes', () => {
    render(AppShellBento, {
      props: { ...baseProps, currentPath: '/login', currentChildId: undefined }
    });
    expect(screen.queryByLabelText('Enregistrer un aliment')).toBeNull();
    expect(screen.queryByLabelText('Navigation principale')).toBeNull();
  });

  it('renders the desktop sidebar nav (always in DOM, hidden until lg via CSS)', () => {
    const { container } = render(AppShellBento, { props: baseProps });
    expect(container.querySelector('nav[aria-label="Navigation latérale"]')).not.toBeNull();
  });

  it('keeps the rail tabs and log CTA on /account via the navChildId fallback', () => {
    const { container } = render(AppShellBento, {
      props: { ...baseProps, currentPath: '/account', currentChildId: undefined }
    });
    const rail = container.querySelector('nav[aria-label="Navigation latérale"]');
    expect(rail).not.toBeNull();
    // Child tabs must point at the first kid, same fallback as the mobile
    // nav (the last tab is /account itself).
    const links = [...rail!.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((href) => href?.startsWith('/child/a')).length).toBe(links.length - 1);
    expect(links).toContain('/account');
    // Log CTAs (mobile FAB + desktop fixed button) also survive on /account.
    expect(screen.getAllByRole('button', { name: /Enregistrer/ }).length).toBeGreaterThanOrEqual(2);
  });

  it('renders no rail tabs on auth routes even when kids exist', () => {
    const { container } = render(AppShellBento, {
      props: { ...baseProps, currentPath: '/login', currentChildId: undefined }
    });
    const rail = container.querySelector('nav[aria-label="Navigation latérale"]');
    expect(rail!.querySelectorAll('a').length).toBe(0);
  });
});
