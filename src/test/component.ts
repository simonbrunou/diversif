import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { createRawSnippet, type Snippet } from 'svelte';

afterEach(async () => {
  cleanup();
  // bits-ui schedules body-scroll-lock cleanup after destroy. Let pending
  // browser cleanup run before happy-dom tears down document.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

export function textSnippet(s: string): Snippet {
  return createRawSnippet(() => ({ render: () => `<span>${s}</span>` })) as unknown as Snippet;
}
