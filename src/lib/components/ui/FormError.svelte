<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils/cn.js';
  import { resolveMessageKey } from '#lib/forms/tracked-enhance.js';

  // Either an action's message key, `<FormError messageKey={form?.errorKey} {form} />`,
  // or prose passed as children. `form` is the page's action data that carried
  // the key: each applied result is a new object, so a second identical
  // refusal re-inserts the alert and screen readers announce it again.
  // SvelteKit's applyAction also passes `form` through null between results
  // today; the key keeps the guarantee when a new result replaces the old one
  // without that step. `form` is required with `messageKey`; forgetting it
  // makes svelte-check report the `children` variant as missing instead.
  // Prose given without `form` (Field) stays in place when it repeats.
  type Props = { class?: string } & (
    | { messageKey: string | null | undefined; form: object | null | undefined; children?: never }
    | { children: Snippet; form?: object | null; messageKey?: never }
  );

  let { class: className = '', messageKey, form, children }: Props = $props();
</script>

{#if children || messageKey}
  {#key form}
    <div
      role="alert"
      class={cn(
        // `text-destructive` is the coral background hue (≈2.4:1 on canvas, worse
        // on the destructive-tinted card). `text-severe-text` is the readable
        // warm-red ink token defined in app.css for both themes.
        'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-severe-text',
        className
      )}
    >
      {#if children}
        {@render children()}
      {:else if messageKey}
        {resolveMessageKey(messageKey)}
      {/if}
    </div>
  {/key}
{/if}
