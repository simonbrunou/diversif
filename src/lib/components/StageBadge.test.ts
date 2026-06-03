import { describe, expect, it } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../test/component';
import StageBadge from './StageBadge.svelte';
import { STAGES } from '$lib/content/guidance';

describe('StageBadge', () => {
  it('renders the stage id and an icon', () => {
    const stage = STAGES[0];
    const { container } = render(StageBadge, { props: { stage } });
    expect(container.textContent).toContain(stage.id);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('appends additional classes', () => {
    const stage = STAGES[0];
    const { container } = render(StageBadge, { props: { stage, class: 'extra' } });
    expect(container.querySelector('span')?.className).toContain('extra');
  });
});
