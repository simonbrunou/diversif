import { describe, expect, it } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../test/component';
import Textarea from './Textarea.svelte';

describe('Textarea', () => {
  it('renders a textarea', () => {
    const { container } = render(Textarea, { props: { placeholder: 'Notes' } });
    const ta = container.querySelector('textarea');
    expect(ta).not.toBeNull();
    expect(ta?.placeholder).toBe('Notes');
  });

  it('forwards attributes via rest', () => {
    const { container } = render(Textarea, { props: { name: 'notes', maxlength: 100 } });
    const ta = container.querySelector('textarea')!;
    expect(ta.getAttribute('name')).toBe('notes');
    expect(ta.maxLength).toBe(100);
  });

  it('binds value', async () => {
    const { container } = render(Textarea, { props: { value: 'hello' } });
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('hello');
    await fireEvent.input(ta, { target: { value: 'world' } });
    expect(ta.value).toBe('world');
  });

  it('appends additional classes', () => {
    const { container } = render(Textarea, { props: { class: 'extra' } });
    expect(container.querySelector('textarea')?.className).toContain('extra');
  });
});
