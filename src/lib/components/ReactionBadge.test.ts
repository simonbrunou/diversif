// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/component';
import ReactionBadge from './ReactionBadge.svelte';

describe('ReactionBadge', () => {
  it.each([
    ['ras', 'RAS'],
    ['inconfort', 'Inconfort'],
    ['reaction', 'Réaction']
  ] as const)('renders the label for reaction=%s', (reaction, label) => {
    const { container } = render(ReactionBadge, { props: { reaction } });
    expect(container.textContent).toContain(label);
  });
});
