<script lang="ts">
  import Callout from './Callout.svelte';
  import { resolveMessageKey } from '#lib/forms/tracked-enhance.js';

  // An action's success key, `<FormSuccess messageKey={form?.savedKey} {form} />`,
  // shown as a success Callout: FormError's counterpart for a result that
  // worked, readable without JavaScript where a toast is not. The status
  // region stays mounted while empty, because screen readers announce text
  // added to a live region that already exists, not reliably a role="status"
  // inserted along with its text. `form` re-inserts the Callout for each new
  // result, as FormError does. `class` goes on the Callout, so the empty
  // region takes no room.
  let {
    messageKey,
    form,
    class: className = ''
  }: {
    messageKey: string | null | undefined;
    form: object | null | undefined;
    class?: string;
  } = $props();
</script>

<div role="status" aria-atomic="true">
  {#key form}
    {#if messageKey}
      <Callout variant="success" class={className}>{resolveMessageKey(messageKey)}</Callout>
    {/if}
  {/key}
</div>
