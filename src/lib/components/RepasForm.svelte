<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLFormAttributes } from 'svelte/elements';
  import { applyAction } from '$app/forms';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { submitRepas, type Submitted } from '#lib/offline/submit.js';
  import * as m from '#lib/paraglide/messages.js';

  // A repas form (log or edit) sent through the durable submit
  // (src/lib/offline/submit.ts) instead of use:enhance. This component only
  // applies the outcome: the server's answer goes to the page as use:enhance
  // would apply it, a queued repas goes back to the dashboard.

  let {
    busy = $bindable(false),
    queueFor,
    children,
    ...attributes
  }: Omit<HTMLFormAttributes, 'method' | 'onsubmit' | 'children'> & {
    /** True from the submit until its outcome is applied. */
    busy?: boolean;
    /** The child to queue the repas for when the server can't be reached: the log form only. */
    queueFor?: number;
    children: Snippet;
  } = $props();

  async function onsubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const form = event.currentTarget;
    let outcome: Submitted;
    try {
      outcome = await submitRepas(new FormData(form, event.submitter), {
        action: form.action,
        queueFor
      });
      if (outcome.kind === 'sent') await applyAction(outcome.result);
    } finally {
      busy = false;
    }
    if (outcome.kind === 'queued') {
      toast.success(m.offlineQueuedToast());
      // The repas is durably queued. Navigation is best-effort: offline, a
      // dashboard that isn't cached makes goto() reject, and the queued row
      // still syncs once the connection is back.
      await goto(`/child/${queueFor}`).catch(() => {});
    } else if (outcome.kind === 'failed') {
      toast.error(m.offlineQueueFailedToast());
    }
  }
</script>

<form method="POST" {...attributes} {onsubmit}>
  {@render children()}
</form>
