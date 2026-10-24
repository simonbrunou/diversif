<script lang="ts">
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import Input from '#lib/components/ui/Input.svelte';
  import Field from '#lib/components/ui/Field.svelte';
  import FormError from '#lib/components/ui/FormError.svelte';
  import FormSuccess from '#lib/components/ui/FormSuccess.svelte';
  import { enhance } from '$app/forms';
  import * as m from '#lib/paraglide/messages.js';
  import { trackSubmission } from '#lib/forms/tracked-enhance.js';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let saving = $state(false);
</script>

<BackHeader title={m.authAccountProfileSection()} />

<!-- Inline rather than toasts: the Toaster is client-only, and a no-JS POST
     re-renders this page with nothing else to say how it went. -->
<FormSuccess messageKey={form?.profileSuccessKey} {form} class="mb-4" />
<form method="POST" class="grid gap-4" use:enhance={trackSubmission((v) => (saving = v))}>
  <FormError messageKey={form?.profileErrorKey} {form} />
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
