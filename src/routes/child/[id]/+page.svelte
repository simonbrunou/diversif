<script lang="ts">
  import AujourdhuiBento from '$lib/components/bento/AujourdhuiBento.svelte';
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
</script>

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
