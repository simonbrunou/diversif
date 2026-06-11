/**
 * Test harness for `createFormToasts`. The helper registers an `$effect`,
 * which requires a reactive context — plain `.test.ts` files are not
 * compiled by the Svelte loader, so this rune-bearing `.svelte.ts` module
 * provides one via `$effect.root`.
 */
import { createFormToasts } from '$lib/forms/form-toasts.svelte';

export function mountFormToasts(keys: { successKey?: string; errorKey?: string }) {
  let form = $state<Record<string, unknown> | null>(null);
  // Extra dependency read by getForm so tests can rerun the effect without
  // changing `form` — exercises the identity-based deduplication.
  let bumpCount = $state(0);

  const destroy = $effect.root(() => {
    createFormToasts(() => {
      void bumpCount;
      return form;
    }, keys);
  });

  return {
    setForm(next: Record<string, unknown> | null) {
      form = next;
    },
    bump() {
      bumpCount += 1;
    },
    destroy
  };
}
