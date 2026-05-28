import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import CoparentsSection from './CoparentsSection.svelte';

afterEach(() => cleanup());

describe('CoparentsSection', () => {
  it('renders an entry per coparent', () => {
    render(CoparentsSection, {
      props: {
        childName: 'Léo',
        coparents: [
          { id: '1', displayName: 'Alice', role: 'co-parent' },
          { id: '2', displayName: 'Bob', role: 'caregiver' }
        ],
        inviteHref: '/child/abc/settings#invite'
      }
    });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows the empty message when no coparents are present', () => {
    render(CoparentsSection, {
      props: { childName: 'Léo', coparents: [], inviteHref: '/child/abc/settings#invite' }
    });
    expect(screen.getByText('Aucun co-parent invité pour l’instant.')).toBeTruthy();
  });

  it('always renders the invite link', () => {
    render(CoparentsSection, {
      props: { childName: 'Léo', coparents: [], inviteHref: '/child/abc/settings#invite' }
    });
    const invite = screen.getByText('Inviter un co-parent').closest('a');
    expect(invite?.getAttribute('href')).toBe('/child/abc/settings#invite');
  });
});
