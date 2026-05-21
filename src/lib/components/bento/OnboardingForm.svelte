<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import Label from '$components/ui/Label.svelte';
  import * as m from '$lib/paraglide/messages';

  type Errors = { firstName?: string; birthDate?: string } | null;
  let { errors }: { errors: Errors } = $props();
</script>

<form method="POST" class="rounded-hero bg-surface px-6 py-7 shadow-soft">
  <h1 class="font-display text-3xl italic">{m.onboardingTitle()}</h1>
  <p class="mt-1 text-sm text-ink-soft">{m.onboardingSubtitle()}</p>

  <Label for="firstName" class="mt-6 block">{m.onboardingFirstNameLabel()}</Label>
  <input
    id="firstName"
    name="firstName"
    type="text"
    required
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
    aria-invalid={errors?.birthDate ? 'true' : undefined}
    aria-describedby={errors?.birthDate ? 'birthDate-error' : undefined}
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.birthDate}
    <p id="birthDate-error" class="mt-1 text-xs text-severe-text">{errors.birthDate}</p>
  {/if}

  <hr class="my-5 border-border" />

  <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">
    {m.onboardingInviteSectionHeader()}
  </p>
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
    class="mt-6 w-full shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.onboardingSubmit()}
  </Button>
</form>
