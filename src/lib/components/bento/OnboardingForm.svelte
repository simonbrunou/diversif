<script lang="ts">
  import { enhance } from '$app/forms';
  import Button from '$lib/components/ui/Button.svelte';
  import Label from '$components/ui/Label.svelte';
  import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';

  type Errors = { firstName?: string; birthDate?: string } | null;
  type Values = { firstName?: string; birthDate?: string } | null;
  let { errors, values = null }: { errors: Errors; values?: Values } = $props();

  let submitting = $state(false);
  // bind:value (state seeded from the action's echo) instead of a one-way
  // value attribute: Svelte re-applies plain value attributes whenever the
  // element re-renders, and the invalidateAll that follows the signup
  // redirect re-renders this page LATE under load — wiping whatever the
  // parent had already typed (seen as real e2e clobbers; same would hit a
  // fast typist on a slow connection). Bound state survives re-renders; the
  // no-JS failure path still echoes via SSR seeding these initials.
  // Seed-once is the point: later prop changes must NOT overwrite what
  // the parent is typing.
  // svelte-ignore state_referenced_locally
  let firstName = $state(values?.firstName ?? '');
  // svelte-ignore state_referenced_locally
  let birthDate = $state(values?.birthDate ?? '');
</script>

<form
  method="POST"
  class="rounded-hero bg-surface px-6 py-7 shadow-soft"
  use:enhance={() => {
    submitting = true;
    return async ({ update }) => {
      // Keep what the parent typed when validation fails — wiping the form
      // on a 400 means retyping everything on the most fragile screen. The
      // button re-enables only after update() so the success redirect can't
      // be double-submitted while the navigation is in flight; finally so an
      // aborted navigation can't leave it stuck disabled.
      try {
        await update({ reset: false });
      } finally {
        submitting = false;
      }
    };
  }}
>
  <h1 class="font-display text-3xl italic">{m.onboardingTitle()}</h1>
  <p class="mt-1 text-sm text-ink-soft">{m.onboardingSubtitle()}</p>

  <Label for="firstName" class="mt-6 block">{m.onboardingFirstNameLabel()}</Label>
  <input
    id="firstName"
    name="firstName"
    type="text"
    required
    bind:value={firstName}
    aria-invalid={errors?.firstName ? 'true' : undefined}
    aria-describedby={errors?.firstName ? 'firstName-error' : undefined}
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.firstName}
    <p id="firstName-error" class="mt-1 text-xs text-severe-text">{errors.firstName}</p>
  {/if}

  <Label for="birthDate" class="mt-4 block">{m.onboardingBirthDateLabel()}</Label>
  <input
    id="birthDate"
    name="birthDate"
    type="date"
    required
    bind:value={birthDate}
    aria-invalid={errors?.birthDate ? 'true' : undefined}
    aria-describedby={errors?.birthDate ? 'birthDate-error' : undefined}
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.birthDate}
    <p id="birthDate-error" class="mt-1 text-xs text-severe-text">{errors.birthDate}</p>
  {/if}

  <hr class="my-5 border-border" />

  <SectionHeader size="sm">{m.onboardingInviteSectionHeader()}</SectionHeader>
  <div class="mt-2 flex items-start gap-2 text-sm">
    <input
      id="inviteCoparent"
      type="checkbox"
      name="inviteCoparent"
      value="1"
      aria-label={m.onboardingInviteCheckbox()}
      class="mt-0.5"
    />
    <label for="inviteCoparent" aria-hidden="true">
      {m.onboardingInviteCheckbox()}
      <span class="block text-xs text-ink-soft">{m.onboardingInviteCaption()}</span>
    </label>
  </div>

  <Button
    type="submit"
    size="pill"
    disabled={submitting}
    class="mt-6 w-full shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.onboardingSubmit()}
  </Button>
</form>
