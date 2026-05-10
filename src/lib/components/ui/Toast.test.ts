// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Toast from './Toast.svelte';

afterEach(() => cleanup());

describe('Toast', () => {
  it('renders the Toaster region', () => {
    const { container } = render(Toast);
    expect(container.querySelector('[role="region"]') ?? container.firstElementChild).toBeTruthy();
  });
});
