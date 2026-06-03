import { describe, expect, it } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../test/component';
import Input from './Input.svelte';

describe('Input', () => {
  it('renders an input element', () => {
    const { container } = render(Input, { props: { placeholder: 'enter' } });
    const el = container.querySelector('input');
    expect(el).not.toBeNull();
    expect(el?.placeholder).toBe('enter');
  });

  it('forwards attributes via rest', () => {
    const { container } = render(Input, {
      props: { name: 'email', type: 'email', required: true }
    });
    const el = container.querySelector('input')!;
    expect(el.getAttribute('name')).toBe('email');
    expect(el.getAttribute('type')).toBe('email');
    expect(el.required).toBe(true);
  });

  it('binds value', async () => {
    const { container } = render(Input, { props: { value: 'initial' } });
    const el = container.querySelector('input') as HTMLInputElement;
    expect(el.value).toBe('initial');
    await fireEvent.input(el, { target: { value: 'updated' } });
    expect(el.value).toBe('updated');
  });

  it('appends additional classes', () => {
    const { container } = render(Input, { props: { class: 'extra' } });
    expect(container.querySelector('input')?.className).toContain('extra');
  });
});
