<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import { createFormToasts } from '$lib/forms/form-toasts.svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let confirmDeleteEmail = $state('');
  let confirmDeletePassword = $state('');
  let deletingAccount = $state(false);

  createFormToasts(() => form, { errorKey: 'deleteErrorKey' });
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
    <div>
      <Button
        type="submit"
        variant="destructive"
        loading={deletingAccount}
        disabled={confirmDeleteEmail.trim().toLowerCase() !== (data.user?.email ?? '') ||
          confirmDeletePassword.length === 0}
      >
        {deletingAccount ? m.authAccountDeleteSubmitting() : m.authAccountDeleteSubmit()}
      </Button>
    </div>
  </form>
</Card>
