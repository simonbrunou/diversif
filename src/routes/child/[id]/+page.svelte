<script lang="ts">
  import AujourdhuiBento from '$lib/components/bento/AujourdhuiBento.svelte';
  import WelcomeDialog from '$lib/components/WelcomeDialog.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import { page } from '$app/state';
  import { toast } from 'svelte-sonner';
  import { celebrate, pickMilestoneFromQuery } from '$lib/utils/milestones';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';
  import { Baby } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Initial state only : once the user closes the dialog (or any other form
  // action runs and re-fires `data`), we must NOT re-open the welcome modal.
  // Server-side dismissal flows through `data.showWelcomeDialog === false` on
  // the next full navigation and re-initializes us correctly. Capturing the
  // initial prop value into $state is exactly what we want here.
  // svelte-ignore state_referenced_locally
  let welcomeOpen = $state(data.showWelcomeDialog);

  $effect(() => {
    const milestone = pickMilestoneFromQuery(
      page.url.searchParams,
      data.diversity.totalCategories
    );
    if (!milestone) return;
    celebrate(toast, milestone);
    const url = new URL(page.url);
    for (const key of [
      'logged',
      'first',
      'allergen',
      'allAllergens',
      'categories',
      'prevCategories'
    ]) {
      url.searchParams.delete(key);
    }
    history.replaceState({}, '', url);
  });
</script>

{#if data.ageMonths < 4 && data.stats.foodsIntroduced === 0}
  <div class="container max-w-2xl px-3 pt-3">
    <TipCard
      tone="info"
      icon={Baby}
      eyebrow={m.preDiversificationEyebrow()}
      title={m.preDiversificationTitle()}
      body={m.preDiversificationBody()}
    >
      <a
        href={localizedHref('/guide')}
        class="inline-flex items-center font-medium text-primary-strong hover:underline"
      >
        {m.preDiversificationCta()} →
      </a>
    </TipCard>
  </div>
{/if}

<AujourdhuiBento
  childId={String(data.child.id)}
  recent={data.recent}
  stats={data.stats}
  streak={data.streak}
  streakRecord={data.streak}
  reminders={data.reminders ?? []}
  priorityAllergensTodo={[]}
/>

<WelcomeDialog bind:open={welcomeOpen} childId={data.child.id} formAction="?/dismissReminder" />
