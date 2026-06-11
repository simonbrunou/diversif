<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Card from '$components/ui/Card.svelte';

  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { toast } from 'svelte-sonner';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let {
    data,
    form
  }: { data: PageData; form: ActionData } = $props();

  let deleteOpen = $state(false);
  let leaveOpen = $state(false);
  let inviteOpen = $state(false);
  let savingChild = $state(false);
  let removeMemberOpen = $state(false);
  let removeMemberId = $state<number | null>(null);

  function askRemoveMember(userId: number) {
    removeMemberId = userId;
    removeMemberOpen = true;
  }

  $effect(() => {
    if (form?.success) {
      toast.success(form.success);
    }
    if (form?.error) {
      toast.error(form.error);
    }
    if (inviteOpen && form?.code) {
      inviteOpen = false;
    }
  });

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(m.settingsCopyToast());
    } catch {
      toast.error(m.settingsCopyFailToast());
    }
  }

  function inviteUrl(code: string): string {
    return `${page.url.origin}/join/${code}`;
  }

</script>

<div class="mx-auto w-full px-4 max-w-2xl space-y-6 py-6">
  <BackHeader title={m.settingsTitle()} subtitle={data.child.name} fallback={`/child/${data.child.id}`} />

  {#if data.role === 'owner'}
    <Card class="p-4">
      <h2 class="text-base font-semibold">{m.settingsInformationsHeading()}</h2>
      <form
        method="POST"
        action="?/updateChild"
        class="mt-3 grid gap-3"
        use:enhance={trackSubmission((v) => (savingChild = v))}
      >
        <Field name="name" label={m.commonFirstName()}>
          <Input id="name" name="name" required maxlength={80} value={data.child.name} />
        </Field>
        <Field name="birthDate" label={m.onboardingBirthDateLabel()}>
          <Input id="birthDate" name="birthDate" type="date" required value={data.child.birthDate} />
        </Field>
        <div>
          <Button type="submit" loading={savingChild}>
            {savingChild ? m.logFormSubmitting() : m.commonSave()}
          </Button>
        </div>
      </form>
    </Card>
  {/if}

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.settingsMembersHeading()}</h2>
    <ul class="mt-3 divide-y">
      {#each data.members as member (member.userId)}
        <li class="flex items-center justify-between py-3">
          <div>
            <div class="font-medium">{member.displayName}</div>
            {#if member.email}
              <div class="text-xs text-muted-foreground">{member.email}</div>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs uppercase tracking-wider text-muted-foreground">
              {member.role === 'owner' ? m.kidPickerRoleOwner() : m.kidPickerRoleMember()}
            </span>
            {#if data.role === 'owner' && member.role !== 'owner'}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => askRemoveMember(member.userId)}
              >
                {m.commonRemove()}
              </Button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </Card>

  {#if data.role === 'owner'}
    <Card id="invite" class="scroll-mt-24 p-4">
      <h2 class="text-base font-semibold">{m.settingsInviteHeading()}</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {m.settingsInviteDescription()}
      </p>

      <div class="mt-3">
        <Button type="button" variant="secondary" onclick={() => (inviteOpen = true)}>
          {m.settingsInviteGenerateCta()}
        </Button>
      </div>

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
                  {m.settingsInviteCopy()}
                </Button>
                <form method="POST" action="?/revokeInvitation">
                  <input type="hidden" name="code" value={inv.code} />
                  <Button type="submit" size="sm" variant="ghost">{m.settingsInvitationRevoke()}</Button>
                </form>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  {/if}

  <Card class="border-destructive/30 p-4">
    <h2 class="text-base font-semibold text-destructive">{m.settingsDangerHeading()}</h2>
    {#if data.role === 'owner'}
      <p class="mt-1 text-sm text-muted-foreground">
        {m.settingsDangerOwnerDescription()}
      </p>
      <div class="mt-3">
        <Button
          type="button"
          variant="destructive"
          onclick={() => (deleteOpen = true)}
        >
          {m.settingsDangerOwnerCta()}
        </Button>
      </div>
    {:else}
      <p class="mt-1 text-sm text-muted-foreground">
        {m.settingsDangerMemberDescription()}
      </p>
      <div class="mt-3">
        <Button type="button" variant="outline" onclick={() => (leaveOpen = true)}>
          {m.settingsDangerMemberCta()}
        </Button>
      </div>
    {/if}
  </Card>
</div>

<ConfirmModal
  bind:open={deleteOpen}
  title={m.settingsDeleteConfirmTitle({ name: data.child.name })}
  description={m.settingsDeleteConfirmDescription({ name: data.child.name })}
  action="?/deleteChild"
  confirmLabel={m.settingsDeleteConfirmLabel()}
  loadingLabel={m.settingsDeleteLoadingLabel()}
  destructive
  requireText={data.child.name}
  requirePassword
/>

<ConfirmModal
  bind:open={removeMemberOpen}
  title={m.settingsRemoveMemberConfirmTitle()}
  description={m.settingsRemoveMemberConfirmDescription()}
  action="?/removeMember"
  confirmLabel={m.commonRemove()}
  loadingLabel={m.settingsRemoveMemberLoadingLabel()}
  destructive
  hiddenFields={{ userId: removeMemberId ?? '' }}
/>

<ConfirmModal
  bind:open={leaveOpen}
  title={m.settingsLeaveConfirmTitle()}
  description={m.settingsLeaveConfirmDescription()}
  action="?/leaveChild"
  confirmLabel={m.settingsLeaveConfirmLabel()}
  loadingLabel={m.settingsLeaveLoadingLabel()}
  destructive
/>

<ConfirmModal
  bind:open={inviteOpen}
  title={m.settingsInviteGenerateCta()}
  description={m.settingsInviteDescription()}
  action="?/createInvitation"
  confirmLabel={m.settingsInviteGenerateCta()}
  loadingLabel={m.settingsInviteGenerating()}
  requirePassword
/>
