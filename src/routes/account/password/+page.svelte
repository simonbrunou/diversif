<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import { enhance } from '$app/forms';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let changing = $state(false);

  function trackSubmission() {
    changing = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      changing = false;
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
    if (form.passwordSuccessKey) toast.success(resolveKey(form.passwordSuccessKey));
    if (form.passwordErrorKey) toast.error(resolveKey(form.passwordErrorKey));
  });
</script>

<BackHeader title={m.authAccountPasswordSection()} />

<form method="POST" class="grid gap-4" use:enhance={trackSubmission}>
  <div class="grid gap-1.5">
    <Label for="currentPassword">{m.authAccountCurrentPasswordLabel()}</Label>
    <Input
      id="currentPassword"
      name="currentPassword"
      type="password"
      required
      autocomplete="current-password"
    />
  </div>
  <div class="grid gap-1.5">
    <Label for="newPassword">{m.authAccountNewPasswordLabel()}</Label>
    <Input
      id="newPassword"
      name="newPassword"
      type="password"
      required
      minlength={12}
      autocomplete="new-password"
    />
  </div>
  <div>
    <Button type="submit" loading={changing}>
      {changing ? m.authAccountPasswordChanging() : m.authAccountPasswordChange()}
    </Button>
  </div>
</form>
