import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { createRawSnippet, type Snippet } from 'svelte';

afterEach(() => cleanup());

export function textSnippet(s: string): Snippet {
  return createRawSnippet(() => ({ render: () => `<span>${s}</span>` })) as unknown as Snippet;
}
