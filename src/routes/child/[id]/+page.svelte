<script lang="ts">
  import AujourdhuiBento from '$lib/components/bento/AujourdhuiBento.svelte';
  import type { SuggestFood } from '$lib/utils/suggest';
  import { goto } from '$app/navigation';
  import WelcomeDialog from '$lib/components/WelcomeDialog.svelte';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import { celebrate, pickMilestoneFromQuery } from '$lib/utils/milestones';
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
      $page.url.searchParams,
      data.diversity.totalCategories
    );
    if (!milestone) return;
    celebrate(toast, milestone);
    const url = new URL($page.url);
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

  function onLogFromHero(food: SuggestFood | null): void {
    // Phase 4 deep-link fallback: AppShellBento's LogSheet wiring is a
    // Phase 4.5 refinement. For now, route the click to the existing log
    // route so users still land on a log form pre-filled (when foodId
    // query supports it) or empty.
    if (food) {
      void goto(`/child/${data.child.id}/log?foodId=${food.id}`);
    } else {
      void goto(`/child/${data.child.id}/log`);
    }
  }
</script>

<AujourdhuiBento
  childId={String(data.child.id)}
  childName={data.child.name}
  recent={data.recent}
  stats={data.stats}
  streak={data.streak}
  streakRecord={data.streak}
  reminders={data.reminders ?? []}
  starterFoods={data.starterFoods ?? []}
  priorityAllergensTodo={[]}
  onLog={onLogFromHero}
/>

<WelcomeDialog
  bind:open={welcomeOpen}
  childId={data.child.id}
  formAction="?/dismissReminder"
/>
