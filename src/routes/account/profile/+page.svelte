<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import { createFormToasts } from '$lib/forms/form-toasts.svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let saving = $state(false);

  createFormToasts(() => form, { successKey: 'profileSuccessKey', errorKey: 'profileErrorKey' });
</script>

<BackHeader title={m.authAccountProfileSection()} />

<form method="POST" class="grid gap-4" use:enhance={trackSubmission((v) => (saving = v))}>
  <Field name="displayName" label={m.authAccountDisplayNameLabel()}>
    <Input
      id="displayName"
      name="displayName"
      required
      maxlength={80}
      value={data.user?.displayName ?? ''}
    />
  </Field>
  <div>
    <Button type="submit" loading={saving}>
      {saving ? m.authAccountSaving() : m.authAccountSave()}
    </Button>
  </div>
</form>
