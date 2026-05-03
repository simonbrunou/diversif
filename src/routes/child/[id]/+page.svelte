<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ReactionBadge from '$lib/components/ReactionBadge.svelte';
  import AllergenProgress from '$lib/components/AllergenProgress.svelte';
  import ReminderBanner from '$lib/components/ReminderBanner.svelte';
  import DiversityCard from '$lib/components/DiversityCard.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import StageBadge from '$lib/components/StageBadge.svelte';
  import WelcomeDialog from '$lib/components/WelcomeDialog.svelte';
  import { formatAge, ageInMonths } from '$lib/utils/age';
  import { getCategoryLabel } from '$lib/utils/categories';
  import {
    getStageForAgeMonths,
    getTipsFor,
    pickRotatingTip
  } from '$lib/content/guidance';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import {
    UserCircle2,
    Plus,
    ShieldCheck,
    Sparkles,
    ChevronRight,
    UtensilsCrossed,
    CalendarDays,
    BookOpen,
    Lightbulb
  } from 'lucide-svelte';
  import dayjs from 'dayjs';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const stageMonths = $derived(ageInMonths(data.child.birthDate));
  const stage = $derived(getStageForAgeMonths(stageMonths));
  const rotatingTip = $derived(
    pickRotatingTip(getTipsFor({ ageMonths: stageMonths }), data.child.id)
  );

  let welcomeOpen = $state(false);
  $effect(() => {
    welcomeOpen = data.showWelcomeDialog;
  });

  // Day-grouping uses the user's local timezone, which differs from the
  // server's. Defer to post-mount so SSR and initial hydration render the
  // same skeleton — otherwise entries near midnight would land in different
  // buckets on the server vs. the client and trigger a hydration mismatch.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });

  $effect(() => {
    if ($page.url.searchParams.get('logged') === '1') {
      toast.success('Aliment enregistré.');
      const url = new URL($page.url);
      url.searchParams.delete('logged');
      history.replaceState({}, '', url);
    }
  });

  type Entry = (typeof data.recent)[number];
  type DayGroup = { key: string; label: string; entries: Entry[] };

  function dayLabel(ts: number): string {
    const d = dayjs(ts);
    const now = dayjs();
    if (d.isSame(now, 'day')) return 'Aujourd’hui';
    if (d.isSame(now.subtract(1, 'day'), 'day')) return 'Hier';
    if (d.isSame(now, 'year')) return d.format('dddd D MMMM');
    return d.format('D MMMM YYYY');
  }

  function groupByDay(entries: Entry[]): DayGroup[] {
    const groups = new Map<string, DayGroup>();
    for (const e of entries) {
      const key = dayjs(e.givenAt).format('YYYY-MM-DD');
      let g = groups.get(key);
      if (!g) {
        g = { key, label: dayLabel(e.givenAt), entries: [] };
        groups.set(key, g);
      }
      g.entries.push(e);
    }
    return Array.from(groups.values());
  }

  const days = $derived(mounted ? groupByDay(data.recent) : []);
</script>

<div class="container max-w-3xl space-y-6 py-6 md:py-8">
  <section
    class="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-accent/40 to-background p-6 shadow-card md:p-8"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wider text-primary/80">Suivi</p>
        <h1 class="mt-1 truncate text-3xl font-semibold leading-tight md:text-4xl">
          {data.child.name}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">{formatAge(data.child.birthDate)}</p>
        <div class="mt-2">
          <StageBadge stage={stage} />
        </div>
      </div>
      <a
        href="/account"
        class="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label="Mon compte"
      >
        <UserCircle2 size={22} aria-hidden="true" />
      </a>
    </div>
    <div class="mt-5">
      <Button href={`/child/${data.child.id}/log`} size="lg" class="w-full sm:w-auto">
        <Plus size={18} aria-hidden="true" />
        Logguer un aliment
      </Button>
    </div>
  </section>

  {#if data.reminders.length > 0}
    <section class="space-y-3" aria-label="Rappels et conseils">
      {#each data.reminders as r (r.key)}
        <ReminderBanner reminder={r} formAction="?/dismissReminder" />
      {/each}
    </section>
  {/if}

  <section class="grid grid-cols-2 gap-3 md:grid-cols-3">
    <Card class="p-4">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <UtensilsCrossed size={14} aria-hidden="true" />
        Aliments
      </div>
      <div class="mt-2 text-3xl font-semibold leading-none">{data.stats.foodsIntroduced}</div>
      <div class="mt-1 text-xs text-muted-foreground">introduits au total</div>
    </Card>
    <Card class="p-4">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ShieldCheck size={14} aria-hidden="true" />
        Allergènes
      </div>
      <div class="mt-2 text-3xl font-semibold leading-none">
        {data.stats.allergens.introduced}
        <span class="text-base font-normal text-muted-foreground">/ {data.stats.allergens.total}</span>
      </div>
      <div class="mt-1 text-xs text-muted-foreground">testés</div>
    </Card>
    <Card class="col-span-2 p-4 md:col-span-1">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <CalendarDays size={14} aria-hidden="true" />
        Cette semaine
      </div>
      <div class="mt-2 text-3xl font-semibold leading-none">{data.stats.weekCount}</div>
      <div class="mt-1 text-xs text-muted-foreground">
        {data.stats.weekCount > 1 ? 'aliments enregistrés' : 'aliment enregistré'}
      </div>
    </Card>
  </section>

  <Card class="p-4 md:p-5">
    <AllergenProgress summary={data.stats.allergens} />
  </Card>

  <DiversityCard metrics={data.diversity} />

  {#if rotatingTip}
    <TipCard
      tone="info"
      icon={Lightbulb}
      eyebrow="Conseil du jour"
      body={rotatingTip.body}
      sources={rotatingTip.sources ? [...rotatingTip.sources] : undefined}
    />
  {/if}

  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">Derniers logs</h2>
      <a
        href={`/child/${data.child.id}/foods`}
        class="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
      >
        Tout voir
      </a>
    </div>

    {#if data.recent.length === 0}
      <EmptyState
        icon={UtensilsCrossed}
        title="Pas encore de log"
        description="Commencez à enregistrer les aliments donnés à {data.child.name}."
      >
        {#snippet action()}
          <Button href={`/child/${data.child.id}/log`}>Logguer le premier</Button>
        {/snippet}
      </EmptyState>
    {:else if !mounted}
      <Card>
        <ul class="divide-y" aria-busy="true">
          {#each data.recent as e (e.id)}
            <li>
              <a
                href={`/child/${data.child.id}/log/${e.id}?from=dashboard`}
                class="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none md:p-4"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate font-medium">{e.foodName}</span>
                    <ReactionBadge reaction={e.reaction} />
                  </div>
                  <div class="mt-0.5 text-xs text-muted-foreground">
                    par {e.loggedByName}
                    <span class="opacity-70">· {getCategoryLabel(e.category)}</span>
                  </div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      </Card>
    {:else}
      <div class="space-y-4">
        {#each days as day (day.key)}
          <div>
            <div class="mb-2 flex items-baseline justify-between px-1">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {day.label}
              </h3>
              <span class="text-xs text-muted-foreground">
                {day.entries.length} {day.entries.length > 1 ? 'entrées' : 'entrée'}
              </span>
            </div>
            <Card>
              <ul class="divide-y">
                {#each day.entries as e (e.id)}
                  <li>
                    <a
                      href={`/child/${data.child.id}/log/${e.id}?from=dashboard`}
                      class="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none md:p-4"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="truncate font-medium">{e.foodName}</span>
                          <ReactionBadge reaction={e.reaction} />
                        </div>
                        <div class="mt-0.5 text-xs text-muted-foreground">
                          {dayjs(e.givenAt).format('HH:mm')} · par {e.loggedByName}
                          <span class="opacity-70">· {getCategoryLabel(e.category)}</span>
                        </div>
                      </div>
                    </a>
                  </li>
                {/each}
              </ul>
            </Card>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <a
      href={`/child/${data.child.id}/allergens`}
      class="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card class="flex items-center justify-between p-4 transition-colors group-hover:bg-accent">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div>
            <div class="text-sm font-medium">Allergènes</div>
            <div class="text-xs text-muted-foreground">Suivi des introductions</div>
          </div>
        </div>
        <ChevronRight size={18} class="text-muted-foreground" aria-hidden="true" />
      </Card>
    </a>
    <a
      href={`/child/${data.child.id}/suggestions`}
      class="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card class="flex items-center justify-between p-4 transition-colors group-hover:bg-accent">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <div>
            <div class="text-sm font-medium">Suggestions</div>
            <div class="text-xs text-muted-foreground">À introduire bientôt</div>
          </div>
        </div>
        <ChevronRight size={18} class="text-muted-foreground" aria-hidden="true" />
      </Card>
    </a>
    <a
      href={`/child/${data.child.id}/guide`}
      class="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card class="flex items-center justify-between p-4 transition-colors group-hover:bg-accent">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <div class="text-sm font-medium">Guide</div>
            <div class="text-xs text-muted-foreground">Conseils, allergènes, sources</div>
          </div>
        </div>
        <ChevronRight size={18} class="text-muted-foreground" aria-hidden="true" />
      </Card>
    </a>
  </section>

  <div class="text-center">
    <a
      href={`/child/${data.child.id}/settings`}
      class="text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
    >
      Paramètres de l’enfant
    </a>
  </div>
</div>

<WelcomeDialog
  bind:open={welcomeOpen}
  childId={data.child.id}
  formAction="?/dismissReminder"
/>
