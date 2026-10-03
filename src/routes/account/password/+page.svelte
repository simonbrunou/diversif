<script lang="ts">
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import Input from '#lib/components/ui/Input.svelte';
  import Field from '#lib/components/ui/Field.svelte';
  import { enhance } from '$app/forms';
  import * as m from '#lib/paraglide/messages.js';
  import { trackSubmission } from '#lib/forms/tracked-enhance.js';
  import { createFormToasts } from '#lib/forms/form-toasts.svelte.js';
  import { PASSWORD_MIN_LENGTH } from '#lib/utils/password.js';
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
      minlength={PASSWORD_MIN_LENGTH}
      autocomplete="new-password"
    />
  </Field>
  <div>
    <Button type="submit" loading={changing}>
      {changing ? m.authAccountPasswordChanging() : m.authAccountPasswordChange()}
    </Button>
  </div>
</form>
