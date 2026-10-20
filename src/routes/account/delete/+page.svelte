<script lang="ts">
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import Card from '#lib/components/ui/Card.svelte';
  import Input from '#lib/components/ui/Input.svelte';
  import Field from '#lib/components/ui/Field.svelte';
  import FormError from '#lib/components/ui/FormError.svelte';
  import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import * as m from '#lib/paraglide/messages.js';
  import { resolveMessageKey, trackSubmission } from '#lib/forms/tracked-enhance.js';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let confirmDeleteEmail = $state('');
  let confirmDeletePassword = $state('');
  let deletingAccount = $state(false);
  // Lowercase both sides, as the action does: an account email stored with
  // mixed case would otherwise never match and keep the button disabled.
  const confirmed = $derived(
    confirmDeleteEmail.trim().toLowerCase() === (data.user?.email ?? '').toLowerCase() &&
      confirmDeletePassword.length > 0
  );
  // The button only waits for `confirmed` once hydrated: SSR renders it
  // enabled so a no-JS visitor can still exercise the right to erasure. The
  // action enforces the same checks and both inputs are required.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
</script>

<BackHeader title={m.authAccountDeleteSection()} />

<Card as="section" variant="tile-butter" class="px-4 py-3">
  <SectionHeader as="h2" tone="destructive">{m.authAccountDeleteSection()}</SectionHeader>
  <p class="mb-3 text-sm text-ink-soft">{m.authAccountDeleteDescription()}</p>
  <form method="POST" class="grid gap-3" use:enhance={trackSubmission((v) => (deletingAccount = v))}>
    <Field name="confirmEmail" label={m.authAccountDeleteConfirmLabel()}>
      <Input
        id="confirmEmail"
        name="confirmEmail"
        type="email"
        autocomplete="off"
        bind:value={confirmDeleteEmail}
        placeholder={data.user?.email ?? ''}
        required
      />
    </Field>
    <Field name="deletePassword" label={m.authAccountDeletePasswordLabel()}>
      <Input
        id="deletePassword"
        name="currentPassword"
        type="password"
        autocomplete="current-password"
        bind:value={confirmDeletePassword}
        required
      />
    </Field>
    {#if form?.deleteErrorKey}
      <!-- Inline rather than a toast: the Toaster is client-only, and a
           refused no-JS POST re-renders this page with nothing else to say why. -->
      <FormError>{resolveMessageKey(form.deleteErrorKey)}</FormError>
    {/if}
    <div>
      <Button
        type="submit"
        variant="destructive"
        loading={deletingAccount}
        disabled={hydrated && !confirmed}
      >
        {deletingAccount ? m.authAccountDeleteSubmitting() : m.authAccountDeleteSubmit()}
      </Button>
    </div>
  </form>
</Card>
