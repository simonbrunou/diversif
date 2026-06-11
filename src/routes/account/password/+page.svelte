<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import { createFormToasts } from '$lib/forms/form-toasts.svelte';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let changing = $state(false);

  createFormToasts(() => form, {
    successKey: 'passwordSuccessKey',
    errorKey: 'passwordErrorKey'
  });
</script>

<BackHeader title={m.authAccountPasswordSection()} />

<form method="POST" class="grid gap-4" use:enhance={trackSubmission((v) => (changing = v))}>
  <Field name="currentPassword" label={m.authAccountCurrentPasswordLabel()}>
    <Input
      id="currentPassword"
      name="currentPassword"
      type="password"
      required
      autocomplete="current-password"
    />
  </Field>
  <Field name="newPassword" label={m.authAccountNewPasswordLabel()}>
    <Input
      id="newPassword"
      name="newPassword"
      type="password"
      required
      minlength={12}
      autocomplete="new-password"
    />
  </Field>
  <div>
    <Button type="submit" loading={changing}>
      {changing ? m.authAccountPasswordChanging() : m.authAccountPasswordChange()}
    </Button>
  </div>
</form>
