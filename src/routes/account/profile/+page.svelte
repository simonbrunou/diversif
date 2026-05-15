<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import { enhance } from '$app/forms';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let saving = $state(false);

  function trackSubmission() {
    saving = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      saving = false;
    };
  }

  function resolveKey(key: string): string {
    const fn = m[key as keyof typeof m] as (() => string) | undefined;
    return fn?.() ?? /* v8 ignore next */ m.errorsGenericFallback();
  }

  let lastFormSeen: typeof form;
  $effect(() => {
    if (form === lastFormSeen) return;
    lastFormSeen = form;
    if (!form) return;
    if (form.profileSuccessKey) toast.success(resolveKey(form.profileSuccessKey));
    if (form.profileErrorKey) toast.error(resolveKey(form.profileErrorKey));
  });
</script>

<BackHeader title={m.authAccountProfileSection()} />

<form method="POST" class="grid gap-4" use:enhance={trackSubmission}>
  <div class="grid gap-1.5">
    <Label for="displayName">{m.authAccountDisplayNameLabel()}</Label>
    <Input
      id="displayName"
      name="displayName"
      required
      maxlength={80}
      value={data.user?.displayName ?? ''}
    />
  </div>
  <div>
    <Button type="submit" loading={saving}>
      {saving ? m.authAccountSaving() : m.authAccountSave()}
    </Button>
  </div>
</form>
