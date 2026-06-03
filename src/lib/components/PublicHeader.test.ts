import { describe, expect, it } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../test/app-stubs';
import { setPagePathname } from '../../test/app-stubs';
import '../../test/component';
import PublicHeader from './PublicHeader.svelte';
import type { SafeUser } from '$lib/types';

const guest = null;
const user: SafeUser = {
  id: 1,
  email: 'a@example.com',
  displayName: 'A',
  createdAt: new Date()
};

describe('PublicHeader', () => {
  it('shows login + signup CTAs for guests', () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user: guest, firstChildId: null }
    });
    expect(container.textContent).toContain('Se connecter');
    expect(container.textContent).toContain('Créer un compte');
  });

  it('shows account + dashboard CTAs for logged-in users', () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user, firstChildId: 7 }
    });
    expect(container.textContent).toContain('Mon carnet');
    expect(container.textContent).toContain('Mon compte');
  });

  it('points dashboard to / when no firstChildId', () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user, firstChildId: null }
    });
    const dashLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Mon carnet')
    );
    expect(dashLink?.getAttribute('href')).toBe('/');
  });

  it('marks /guide as active when on /guide', () => {
    setPagePathname('/guide');
    const { container } = render(PublicHeader, {
      props: { user: guest, firstChildId: null }
    });
    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/guide');
  });

  it('considers /guide active for nested paths under /guide/', () => {
    setPagePathname('/guide/details');
    const { container } = render(PublicHeader, {
      props: { user: guest, firstChildId: null }
    });
    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/guide');
  });

  it('toggles the mobile menu', async () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user: guest, firstChildId: null }
    });
    const burger = container.querySelector('button[aria-controls="public-mobile-nav"]')!;
    expect(container.querySelector('#public-mobile-nav')).toBeNull();
    await fireEvent.click(burger);
    expect(container.querySelector('#public-mobile-nav')).not.toBeNull();
    await fireEvent.click(burger);
    expect(container.querySelector('#public-mobile-nav')).toBeNull();
  });

  it('closes the mobile menu when a link is clicked', async () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user: guest, firstChildId: null }
    });
    const burger = container.querySelector('button[aria-controls="public-mobile-nav"]')!;
    await fireEvent.click(burger);
    const link = container.querySelector('#public-mobile-nav a')!;
    await fireEvent.click(link);
    expect(container.querySelector('#public-mobile-nav')).toBeNull();
  });

  it('renders the mobile menu with guest CTAs', async () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user: guest, firstChildId: null }
    });
    await fireEvent.click(container.querySelector('button[aria-controls="public-mobile-nav"]')!);
    const mobile = container.querySelector('#public-mobile-nav')!;
    expect(mobile.textContent).toContain('Se connecter');
  });

  it('renders the mobile menu with user CTAs', async () => {
    setPagePathname('/');
    const { container } = render(PublicHeader, {
      props: { user, firstChildId: 7 }
    });
    await fireEvent.click(container.querySelector('button[aria-controls="public-mobile-nav"]')!);
    const mobile = container.querySelector('#public-mobile-nav')!;
    expect(mobile.textContent).toContain('Mon carnet');
  });
});
