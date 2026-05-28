import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import DetailSheet from './DetailSheet.svelte';

afterEach(() => cleanup());

describe('DetailSheet', () => {
  it('renders the title when open', () => {
    render(DetailSheet, {
      props: { open: true, title: 'Lait', children: textSnippet('body') }
    });
    expect(screen.getByText('Lait')).toBeTruthy();
  });

  it('renders the intro paragraph when provided', () => {
    render(DetailSheet, {
      props: {
        open: true,
        title: 'Lait',
        intro: 'Premier grand allergène à introduire tôt.',
        children: textSnippet('body')
      }
    });
    expect(screen.getByText('Premier grand allergène à introduire tôt.')).toBeTruthy();
  });

  it('does not render the intro when omitted', () => {
    render(DetailSheet, {
      props: { open: true, title: 'Lait', children: textSnippet('the body content') }
    });
    expect(screen.queryByText(/premier grand allergène/i)).toBeNull();
    expect(screen.getByText('the body content')).toBeTruthy();
  });

  it('does not render the dialog content when open=false', () => {
    render(DetailSheet, {
      props: { open: false, title: 'Lait', children: textSnippet('body') }
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the footer snippet when provided', () => {
    render(DetailSheet, {
      props: {
        open: true,
        title: 'Lait',
        children: textSnippet('body'),
        footer: textSnippet('FOOTER_CONTENT')
      }
    });
    expect(screen.getByText('FOOTER_CONTENT')).toBeTruthy();
  });

  it('forwards a custom class to the sheet', () => {
    render(DetailSheet, {
      props: { open: true, title: 'Lait', class: 'max-w-lg', children: textSnippet('body') }
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain('max-w-lg');
  });
});
