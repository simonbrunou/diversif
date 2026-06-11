<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Field from './Field.svelte';

  let {
    open = $bindable(false),
    title,
    description,
    action,
    confirmLabel,
    loadingLabel,
    destructive = false,
    requireText,
    requirePassword = false,
    hiddenFields
  }: {
    open?: boolean;
    title: string;
    description?: string;
    action: string;
    confirmLabel: string;
    loadingLabel?: string;
    destructive?: boolean;
    /** When set, a text input appears whose value must equal this string. */
    requireText?: string;
    /** When true, a `currentPassword` input appears and must be non-empty. */
    requirePassword?: boolean;
    /** Extra `<input type="hidden">` fields posted with the confirmation. */
    hiddenFields?: Record<string, string | number>;
  } = $props();

  let submitting = $state(false);
  let confirmText = $state('');
  let confirmPassword = $state('');

  const textOk = $derived(requireText ? confirmText === requireText : true);
  const passwordOk = $derived(requirePassword ? confirmPassword.length > 0 : true);
  const canSubmit = $derived(textOk && passwordOk);

  // Reset confirmation state on every close (Cancel, Escape, overlay click,
  // parent-driven `open = false`) so a reopened modal never inherits prior
  // satisfied gates — the destructive-confirm safety net would be paper-thin
  // otherwise.
  $effect(() => {
    if (!open) {
      confirmText = '';
      confirmPassword = '';
    }
  });

  function close() {
    open = false;
  }
</script>

<Modal bind:open side="center" {title} {description}>
  <form
    method="POST"
    {action}
    class="grid gap-3"
    use:enhance={() => {
      submitting = true;
      return async ({ result, update }) => {
        try {
          await update();
        } finally {
          submitting = false;
        }
        // Close after a successful action so non-navigating confirms (member
        // removal, symptom/meal deletion) don't leave the modal hanging open.
        // Failures keep it open so the user can retry (e.g. wrong password).
        if (result.type === 'success' || result.type === 'redirect') {
          open = false;
        }
      };
    }}
  >
    {#each Object.entries(hiddenFields ?? {}) as [name, value] (name)}
      <input type="hidden" {name} {value} />
    {/each}
    {#if requireText}
      <Field name="confirmText" label={m.commonConfirmTextLabel({ text: requireText })}>
        <Input
          id="confirmText"
          name="confirmText"
          bind:value={confirmText}
          placeholder={requireText}
          autocomplete="off"
        />
      </Field>
    {/if}
    {#if requirePassword}
      <Field name="currentPassword" label={m.commonPassword()}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autocomplete="current-password"
          bind:value={confirmPassword}
          required
        />
      </Field>
    {/if}
    <div class="mt-2 flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={close}>{m.commonCancel()}</Button>
      <Button
        type="submit"
        variant={destructive ? 'destructive' : 'default'}
        loading={submitting}
        disabled={!canSubmit}
      >
        {submitting && loadingLabel ? loadingLabel : confirmLabel}
      </Button>
    </div>
  </form>
</Modal>
