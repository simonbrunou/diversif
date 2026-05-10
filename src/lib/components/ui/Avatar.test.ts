// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Avatar from './Avatar.svelte';

afterEach(() => cleanup());

describe('Avatar', () => {
  it('renders the fallback initials when no src is given', () => {
    render(Avatar, { props: { fallback: 'LB' } });
    expect(screen.getByText('LB')).toBeTruthy();
  });

  it('renders an image when src is provided', () => {
    const { container } = render(Avatar, {
      props: { src: '/x.png', alt: 'pic', fallback: 'PI' }
    });
    expect(container.querySelector('img')).not.toBeNull();
  });
});
