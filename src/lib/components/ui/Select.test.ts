import { describe, expect, it } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../test/component';
import { textSnippet } from '../../../test/component';
import Select from './Select.svelte';

describe('Select', () => {
  it('renders a select with the chevron icon', () => {
    const { container } = render(Select, { props: { children: textSnippet('opts') } });
    expect(container.querySelector('select')).not.toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('forwards attributes via rest', () => {
    const { container } = render(Select, {
      props: { name: 'category', disabled: true, children: textSnippet('opts') }
    });
    const sel = container.querySelector('select')!;
    expect(sel.getAttribute('name')).toBe('category');
    expect(sel.disabled).toBe(true);
  });

  it('appends additional classes', () => {
    const { container } = render(Select, {
      props: { class: 'extra', children: textSnippet('opts') }
    });
    expect(container.querySelector('select')?.className).toContain('extra');
  });

  it('reflects value updates', async () => {
    const { container } = render(Select, {
      props: {
        value: 'b',
        children: textSnippet('<option value="a">A</option><option value="b">B</option>')
      }
    });
    const sel = container.querySelector('select') as HTMLSelectElement;
    sel.value = 'a';
    await fireEvent.change(sel);
    expect(sel.value).toBe('a');
  });
});
