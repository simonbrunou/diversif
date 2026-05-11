<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  type Errors = { firstName?: string; birthDate?: string } | null;
  let { errors }: { errors: Errors } = $props();
</script>

<form method="POST" class="rounded-hero bg-surface px-6 py-7 shadow-soft">
  <h1 class="font-display text-3xl italic">{m.onboardingTitle()}</h1>
  <p class="mt-1 text-sm text-ink-soft">{m.onboardingSubtitle()}</p>

  <label class="mt-6 block text-xs font-semibold uppercase tracking-wider text-ink-soft" for="firstName">
    {m.onboardingFirstNameLabel()}
  </label>
  <input
    id="firstName"
    name="firstName"
    type="text"
    required
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.firstName}
    <p class="mt-1 text-xs text-severe">{errors.firstName}</p>
  {/if}

  <label class="mt-4 block text-xs font-semibold uppercase tracking-wider text-ink-soft" for="birthDate">
    {m.onboardingBirthDateLabel()}
  </label>
  <input
    id="birthDate"
    name="birthDate"
    type="date"
    required
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.birthDate}
    <p class="mt-1 text-xs text-severe">{errors.birthDate}</p>
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

  <button
    type="submit"
    class="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.onboardingSubmit()}
  </button>
</form>
