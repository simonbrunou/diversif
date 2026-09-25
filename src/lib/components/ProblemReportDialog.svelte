<script lang="ts">
  import Modal from '$components/ui/Modal.svelte';
  import Button from '$components/ui/Button.svelte';
  import Field from '$components/ui/Field.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import * as m from '$lib/paraglide/messages';
  import { sendProblemReport } from '$lib/sentry-feedback';

  let {
    open = $bindable(false),
    tags = {}
  }: {
    open?: boolean;
    /** Sent with the report, e.g. `{ errorId }` from the error page. */
    tags?: Record<string, string>;
  } = $props();

  let message = $state('');
  let status = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  // Every close (Cancel, Escape, overlay, the X) starts the next report fresh.
  $effect(() => {
    if (!open) {
      message = '';
      status = 'idle';
    }
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    status = 'sending';
    try {
      await sendProblemReport(message.trim(), tags);
      status = 'sent';
    } catch {
      status = 'failed';
    }
  }
</script>

<Modal bind:open side="auto" title={m.feedbackReportProblem()}>
  {#if status === 'sent'}
    <p class="text-sm" role="status">{m.feedbackSuccess()}</p>
    <div class="flex justify-end">
      <Button type="button" onclick={() => (open = false)}>{m.feedbackClose()}</Button>
    </div>
  {:else}
    <form class="grid gap-3" onsubmit={submit}>
      <Field name="problem-report-message" label={m.feedbackMessageLabel()}>
        <Textarea
          id="problem-report-message"
          bind:value={message}
          placeholder={m.feedbackMessagePlaceholder()}
          maxlength={2000}
          rows={5}
          required
        />
      </Field>
      {#if status === 'failed'}
        <p class="text-sm text-severe-text" role="alert">{m.feedbackErrorGeneric()}</p>
      {/if}
      <div class="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onclick={() => (open = false)}>
          {m.commonCancel()}
        </Button>
        <Button
          type="submit"
          loading={status === 'sending'}
          disabled={message.trim() === ''}
        >
          {m.feedbackSubmit()}
        </Button>
      </div>
    </form>
  {/if}
</Modal>
