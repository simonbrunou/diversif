<script lang="ts">
  import { enhance } from '$app/forms';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '../ui/Modal.svelte';
  import Label from '$components/ui/Label.svelte';
  import * as m from '$lib/paraglide/messages';
  import {
    SYMPTOM_LABELS,
    severityOf,
    symptomLabelText,
    type SymptomLabel
  } from '$lib/content/symptoms';

  let {
    open = $bindable(false),
    action
  }: { open: boolean; action: string } = $props();

  let selected = $state<SymptomLabel | null>(null);
  let note = $state('');
  let observedAt = $state(new Date().toTimeString().slice(0, 5));
  let submitting = $state(false);
  let failed = $state(false);

  // The sheet stays mounted across opens (only `open` toggles), so reset every
  // form field when it re-opens. Otherwise a dismissed-without-submit selection
  // would persist and bypass the "no preselect" safeguard on the next open.
  $effect(() => {
    if (open) {
      selected = null;
      note = '';
      observedAt = new Date().toTimeString().slice(0, 5);
      failed = false;
    }
  });

</script>

<Modal bind:open title={m.addSymptomTitle()} side="auto" scrollableBody>
  <form
    method="POST"
    action={`${action}?/addSymptom`}
    use:enhance={trackSubmission(
      (v) => {
        submitting = v;
        if (v) failed = false;
      },
      {
        // The disabled submit button is the visible no-selection gate; this
        // is the programmatic one (use:enhance submits even when default is
        // prevented, so an onsubmit guard would be inert).
        beforeSubmit: () => selected !== null,
        // Keep what the parent typed when validation fails.
        reset: false,
        // Plain POST used to reload the page, which closed the sheet. With
        // enhance there is no reload, so close it ourselves — before the
        // refreshed list renders, so sheet content never overlaps the new row.
        onSuccess: () => (open = false),
        // The host page doesn't consume `form`, so failures must surface here.
        onFailure: () => (failed = true)
      }
    )}
  >
    <fieldset>
      <legend class="text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {m.addSymptomLabel()}
      </legend>
      <div class="mt-2 grid grid-cols-2 gap-2">
        {#each SYMPTOM_LABELS as label (label)}
          {@const isSelected = selected === label}
          {@const isSevere = severityOf(label) === 'severe'}
          <label
            class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 {isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : isSevere
                ? 'border-destructive/40 bg-canvas text-severe-text'
                : 'border-border bg-canvas text-ink-soft'}"
          >
            <input
              type="radio"
              name="label"
              value={label}
              checked={isSelected}
              onchange={() => (selected = label)}
              class="sr-only"
            />
            {#if isSevere}
              <span class="sr-only">{m.addSymptomSeveritySevereSrPrefix()} </span>
            {/if}
            {symptomLabelText(label)}
          </label>
        {/each}
      </div>
    </fieldset>

    <Label for="symptom-note" class="mt-4 block">{m.addSymptomNote()}</Label>
    <textarea
      id="symptom-note"
      name="note"
      maxlength="280"
      bind:value={note}
      placeholder={m.addSymptomNotePlaceholder()}
      class="mt-1 w-full touch-pan-y rounded-tile border border-border bg-canvas p-2 text-sm"
      rows="3"
    ></textarea>

    <Label for="symptom-observed-at" class="mt-4 block">{m.addSymptomObservedAt()}</Label>
    <input
      id="symptom-observed-at"
      type="time"
      name="observedAt"
      bind:value={observedAt}
      class="mt-1 rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
    />

    {#if failed}
      <p class="mt-3 text-sm text-severe-text" role="alert">{m.errorsGenericFallback()}</p>
    {/if}

    <Button
      type="submit"
      size="pill"
      disabled={selected === null || submitting}
      class="mt-5 w-full shadow-soft transition-transform duration-base ease-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-primary/40 disabled:active:scale-100"
    >
      {m.addSymptomSubmit()}
    </Button>
  </form>
</Modal>
