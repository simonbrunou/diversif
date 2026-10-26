<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils/cn.js';
  import { resolveMessageKey } from '#lib/forms/tracked-enhance.js';
  import { isHydrated } from '#lib/boot-recovery.js';

  // Either an action's message key, `<FormError messageKey={form?.errorKey} {form} />`,
  // or prose passed as children. `form` is the page's action data that carried
  // the key: each applied result is a new object, so a second identical
  // refusal re-inserts the alert and screen readers announce it again.
  // SvelteKit's applyAction also passes `form` through null between results
  // today; the key keeps the guarantee when a new result replaces the old one
  // without that step. `form` is required with `messageKey`; forgetting it
  // makes svelte-check report the `children` variant as missing instead.
  // Prose given without `form` (Field) stays in place when it repeats.
  //
  // A refusal without JavaScript loads a new document, and screen readers do
  // not read an alert that is already in the page at load. So an alert the
  // server rendered takes focus on load instead, and the reader reads it out
  // (#469). An alert inserted after hydration, the JavaScript path, leaves
  // focus where it is: screen readers announce its insertion.
  type Props = { class?: string } & (
    | { messageKey: string | null | undefined; form: object | null | undefined; children?: never }
    | { children: Snippet; form?: object | null; messageKey?: never }
  );

  let { class: className = '', messageKey, form, children }: Props = $props();
</script>

{#key form}
  {#if children || messageKey}
    <!-- The key replaces the alert, so this check runs once per alert. An
         alert that renders before the app has hydrated came from the server. -->
    {@const serverRendered = !isHydrated()}
    <!-- The rule flags autofocus, but a screen reader reads a server-rendered alert only once it has focus. -->
    <!-- svelte-ignore a11y_autofocus -->
    <div
      role="alert"
      tabindex="-1"
      autofocus={serverRendered}
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
  {/if}
{/key}
