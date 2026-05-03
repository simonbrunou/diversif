// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { Apple } from 'lucide-svelte';
import '../../test/component';
import { textSnippet } from '../../test/component';
import EmptyState from './EmptyState.svelte';

describe('EmptyState', () => {
  it('renders the title only', () => {
    const { container } = render(EmptyState, { props: { title: 'No data' } });
    expect(container.textContent).toContain('No data');
  });

  it('renders the description when provided', () => {
    const { container } = render(EmptyState, {
      props: { title: 'No data', description: 'Add some' }
    });
    expect(container.textContent).toContain('Add some');
  });

  it('renders the action snippet', () => {
    const { container } = render(EmptyState, {
      props: { title: 'No data', action: textSnippet('Action!') }
    });
    expect(container.textContent).toContain('Action!');
  });

  it('uses a custom icon when provided', () => {
    const { container } = render(EmptyState, {
      props: { title: 'No data', icon: Apple }
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
