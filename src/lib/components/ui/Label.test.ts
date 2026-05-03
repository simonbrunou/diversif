// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import { textSnippet } from '../../../test/component';
import Label from './Label.svelte';

describe('Label', () => {
  it('renders children inside a label', () => {
    const { container } = render(Label, { props: { children: textSnippet('Email') } });
    expect(container.querySelector('label')?.textContent).toContain('Email');
  });

  it('forwards `for` via rest', () => {
    const { container } = render(Label, {
      props: { for: 'email-input', children: textSnippet('Email') }
    });
    expect(container.querySelector('label')?.getAttribute('for')).toBe('email-input');
  });

  it('appends additional classes', () => {
    const { container } = render(Label, {
      props: { class: 'extra', children: textSnippet('X') }
    });
    expect(container.querySelector('label')?.className).toContain('extra');
  });

  it('renders without children', () => {
    const { container } = render(Label, { props: {} });
    expect(container.querySelector('label')).not.toBeNull();
  });
});
