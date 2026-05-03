// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/app-stubs';
import { setPagePathname } from '../../test/app-stubs';
import '../../test/component';
import { textSnippet } from '../../test/component';
import AppShell from './AppShell.svelte';

describe('AppShell', () => {
  it('renders the child name and an age label', () => {
    setPagePathname('/child/1');
    const { container } = render(AppShell, {
      props: {
        childId: 1,
        childName: 'Lulu',
        birthDate: '2024-01-01',
        children: textSnippet('Main')
      }
    });
    expect(container.textContent).toContain('Lulu');
    expect(container.textContent).toContain('Main');
  });

  it('renders all 6 nav items including the guide', () => {
    setPagePathname('/child/1');
    const { container } = render(AppShell, {
      props: {
        childId: 1,
        childName: 'Lulu',
        birthDate: '2024-01-01',
        children: textSnippet('Main')
      }
    });
    const items = container.querySelectorAll('aside nav ul li');
    expect(items.length).toBe(6);
  });

  it('marks the dashboard nav item active when on /child/{id}', () => {
    setPagePathname('/child/1');
    const { container } = render(AppShell, {
      props: {
        childId: 1,
        childName: 'Lulu',
        birthDate: '2024-01-01',
        children: textSnippet('Main')
      }
    });
    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/child/1');
  });

  it('marks /account as active when pathname matches', () => {
    setPagePathname('/account');
    const { container } = render(AppShell, {
      props: {
        childId: 1,
        childName: 'Lulu',
        birthDate: '2024-01-01',
        children: textSnippet('Main')
      }
    });
    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/account');
  });
});
