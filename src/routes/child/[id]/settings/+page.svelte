<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Card from '$components/ui/Card.svelte';

  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import * as msg from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let {
    data,
    form
  }: { data: PageData; form: ActionData } = $props();

  let deleteOpen = $state(false);
  let leaveOpen = $state(false);
  let savingChild = $state(false);
  let creatingInvite = $state(false);

  $effect(() => {
    if (form?.success) {
      toast.success(form.success);
    }
    if (form?.error) {
      toast.error(form.error);
    }
  });

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(msg.settingsCopyToast());
    } catch {
      toast.error(msg.settingsCopyFailToast());
    }
  }

  function inviteUrl(code: string): string {
    return `${$page.url.origin}/join/${code}`;
  }

</script>

<div class="container max-w-2xl space-y-6 py-6">
  <BackHeader title={msg.settingsTitle()} subtitle={data.child.name} fallback={`/child/${data.child.id}`} />

  {#if data.role === 'owner'}
    <Card class="p-4">
      <h2 class="text-base font-semibold">{msg.settingsInformationsHeading()}</h2>
      <form
        method="POST"
        action="?/updateChild"
        class="mt-3 grid gap-3"
        use:enhance={trackSubmission((v) => (savingChild = v))}
      >
        <Field name="name" label={msg.commonFirstName()}>
          <Input id="name" name="name" required maxlength={80} value={data.child.name} />
        </Field>
        <Field name="birthDate" label={msg.onboardingBirthDateLabel()}>
          <Input id="birthDate" name="birthDate" type="date" required value={data.child.birthDate} />
        </Field>
        <div>
          <Button type="submit" loading={savingChild}>
            {savingChild ? msg.logFormSubmitting() : msg.commonSave()}
          </Button>
        </div>
      </form>
    </Card>
  {/if}

  <Card class="p-4">
    <h2 class="text-base font-semibold">{msg.settingsMembersHeading()}</h2>
    <ul class="mt-3 divide-y">
      {#each data.members as m (m.userId)}
        <li class="flex items-center justify-between py-3">
          <div>
            <div class="font-medium">{m.displayName}</div>
            {#if m.email}
              <div class="text-xs text-muted-foreground">{m.email}</div>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs uppercase tracking-wider text-muted-foreground">
              {m.role === 'owner' ? msg.kidPickerRoleOwner() : msg.kidPickerRoleMember()}
            </span>
            {#if data.role === 'owner' && m.role !== 'owner'}
              <form method="POST" action="?/removeMember">
                <input type="hidden" name="userId" value={m.userId} />
                <Button type="submit" variant="ghost" size="sm">{msg.commonRemove()}</Button>
              </form>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </Card>

  {#if data.role === 'owner'}
    <Card id="invite" class="scroll-mt-24 p-4">
      <h2 class="text-base font-semibold">{msg.settingsInviteHeading()}</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {msg.settingsInviteDescription()}
      </p>

      <form
        method="POST"
        action="?/createInvitation"
        class="mt-3"
        use:enhance={trackSubmission((v) => (creatingInvite = v))}
      >
        <Button type="submit" variant="secondary" loading={creatingInvite}>
          {creatingInvite ? msg.settingsInviteGenerating() : msg.settingsInviteGenerateCta()}
        </Button>
      </form>

      {#if data.invitations.length > 0}
        <ul class="mt-4 grid gap-2">
          {#each data.invitations as inv (inv.code)}
            <li class="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div class="min-w-0">
                <div class="font-mono text-sm font-medium">{inv.code}</div>
                <div class="truncate text-xs text-muted-foreground">{inviteUrl(inv.code)}</div>
              </div>
              <div class="flex gap-2">
                <Button type="button" size="sm" variant="outline" onclick={() => copy(inviteUrl(inv.code))}>
                  {msg.settingsInviteCopy()}
                </Button>
                <form method="POST" action="?/revokeInvitation">
                  <input type="hidden" name="code" value={inv.code} />
                  <Button type="submit" size="sm" variant="ghost">{msg.settingsInvitationRevoke()}</Button>
                </form>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  {/if}

  <Card class="border-destructive/30 p-4">
    <h2 class="text-base font-semibold text-destructive">{msg.settingsDangerHeading()}</h2>
    {#if data.role === 'owner'}
      <p class="mt-1 text-sm text-muted-foreground">
        {msg.settingsDangerOwnerDescription()}
      </p>
      <div class="mt-3">
        <Button
          type="button"
          variant="destructive"
          onclick={() => (deleteOpen = true)}
        >
          {msg.settingsDangerOwnerCta()}
        </Button>
      </div>
    {:else}
      <p class="mt-1 text-sm text-muted-foreground">
        {msg.settingsDangerMemberDescription()}
      </p>
      <div class="mt-3">
        <Button type="button" variant="outline" onclick={() => (leaveOpen = true)}>
          {msg.settingsDangerMemberCta()}
        </Button>
      </div>
    {/if}
  </Card>
</div>

<ConfirmModal
  bind:open={deleteOpen}
  title={msg.settingsDeleteConfirmTitle({ name: data.child.name })}
  description={msg.settingsDeleteConfirmDescription({ name: data.child.name })}
  action="?/deleteChild"
  confirmLabel={msg.settingsDeleteConfirmLabel()}
  loadingLabel={msg.settingsDeleteLoadingLabel()}
  destructive
  requireText={data.child.name}
  requirePassword
/>

<ConfirmModal
  bind:open={leaveOpen}
  title={msg.settingsLeaveConfirmTitle()}
  description={msg.settingsLeaveConfirmDescription()}
  action="?/leaveChild"
  confirmLabel={msg.settingsLeaveConfirmLabel()}
  loadingLabel={msg.settingsLeaveLoadingLabel()}
  destructive
/>
