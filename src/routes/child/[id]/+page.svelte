<script lang="ts">
  import AujourdhuiBento from '$lib/components/bento/AujourdhuiBento.svelte';
  import BentoOptInBanner from '$lib/components/bento/BentoOptInBanner.svelte';
  import type { SuggestFood } from '$lib/utils/suggest';
  import { goto } from '$app/navigation';
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
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import { formatAge, ageInMonths } from '$lib/utils/age';
  import {
    getStageForAgeMonths,
    getTipsFor,
    pickRotatingTip
  } from '$lib/content/guidance';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import { celebrate, pickMilestoneFromQuery } from '$lib/utils/milestones';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import {
    UserCircle2,
    Plus,
    ShieldCheck,
    Sparkles,
    ChevronRight,
    UtensilsCrossed,
    CalendarDays,
    BookOpen,
    Lightbulb,
    Flame,
    Users
  } from 'lucide-svelte';
  import dayjs from 'dayjs';
  import 'dayjs/locale/fr';
  import relativeTime from 'dayjs/plugin/relativeTime';
  import { languageTag } from '$lib/paraglide/runtime';
  dayjs.extend(relativeTime);
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const stageMonths = $derived(ageInMonths(data.child.birthDate));
  const stage = $derived(getStageForAgeMonths(stageMonths));
  const rotatingTip = $derived(
    pickRotatingTip(getTipsFor({ ageMonths: stageMonths }), data.child.id)
  );

  // Initial state only — once the user closes the dialog (or any other form
  // action runs and re-fires `data`), we must NOT re-open the welcome modal.
  // Server-side dismissal flows through `data.showWelcomeDialog === false` on
  // the next full navigation and re-initializes us correctly. Capturing the
  // initial prop value into $state is exactly what we want here.
  // svelte-ignore state_referenced_locally
  let welcomeOpen = $state(data.showWelcomeDialog);

  // Day-grouping uses the user's local timezone, which differs from the
  // server's. Defer to post-mount so SSR and initial hydration render the
  // same skeleton — otherwise entries near midnight would land in different
  // buckets on the server vs. the client and trigger a hydration mismatch.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });

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

  type Entry = (typeof data.recent)[number];
  type DayGroup = { key: string; label: string; entries: Entry[] };

  function dayLabel(ts: number): string {
    const locale = languageTag();
    const d = dayjs(ts).locale(locale);
    const now = dayjs().locale(locale);
    if (d.isSame(now, 'day')) return m.dateLabelToday();
    if (d.isSame(now.subtract(1, 'day'), 'day')) return m.dateLabelYesterday();
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

  const streakLabel = $derived(
    data.streak === 1
      ? m.dashboardStreakLabelOne({ days: data.streak })
      : m.dashboardStreakLabelOther({ days: data.streak })
  );

  const weekCountLabel = $derived(
    data.stats.weekCount === 1
      ? m.dashboardWeekCountLabelOne({ count: data.stats.weekCount })
      : m.dashboardWeekCountLabelOther({ count: data.stats.weekCount })
  );

  const weeklyRecapMealsLabel = $derived(
    data.weeklyRecap.entries === 1
      ? m.dashboardWeeklyRecapMealsOne({ count: data.weeklyRecap.entries })
      : m.dashboardWeeklyRecapMealsOther({ count: data.weeklyRecap.entries })
  );

  const weeklyRecapNewFoodsLabel = $derived(
    data.weeklyRecap.newFoods === 1
      ? m.dashboardWeeklyRecapNewFoodsOne({ count: data.weeklyRecap.newFoods })
      : m.dashboardWeeklyRecapNewFoodsOther({ count: data.weeklyRecap.newFoods })
  );

  const weeklyRecapNewAllergensLabel = $derived(
    data.weeklyRecap.newAllergens === 1
      ? m.dashboardWeeklyRecapNewAllergensOne({ count: data.weeklyRecap.newAllergens })
      : m.dashboardWeeklyRecapNewAllergensOther({ count: data.weeklyRecap.newAllergens })
  );
</script>

{#if data.bento}
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
{:else}
<BentoOptInBanner childId={String(data.child.id)} />
<div class="container max-w-3xl space-y-6 py-6 md:py-8">
  <section
    class="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-accent/40 to-background p-6 shadow-card md:p-8"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wider text-primary/80">{m.dashboardTrackingLabel()}</p>
        <h1 class="mt-1 truncate font-display text-3xl font-semibold leading-tight md:text-4xl">
          {data.child.name}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">{formatAge(data.child.birthDate)}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <StageBadge stage={stage} />
          {#if data.streak >= 2}
            <span
              class="inline-flex items-center gap-1 rounded-full bg-celebrate/15 px-2 py-0.5 text-xs font-medium text-celebrate-foreground ring-1 ring-celebrate/30"
              aria-label={streakLabel}
            >
              <Flame size={12} class="text-celebrate" aria-hidden="true" />
              {streakLabel}
            </span>
          {/if}
        </div>
      </div>
      <a
        href={localizedHref('/account')}
        class="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        aria-label={m.dashboardMyAccount()}
      >
        <UserCircle2 size={22} aria-hidden="true" />
      </a>
    </div>
    <div class="mt-5">
      <Button href={localizedHref(`/child/${data.child.id}/log`)} size="lg" class="w-full sm:w-auto">
        <Plus size={18} aria-hidden="true" />
        {m.dashboardLogCta()}
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
        {m.dashboardFoodsLabel()}
      </div>
      <div class="mt-2 font-display text-2xl font-semibold leading-none tabular-nums md:text-3xl">{data.stats.foodsIntroduced}</div>
      <div class="mt-1 text-xs text-muted-foreground">{m.dashboardFoodsIntroducedLabel()}</div>
    </Card>
    <Card class="p-4">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ShieldCheck size={14} aria-hidden="true" />
        {m.dashboardAllergensLabel()}
      </div>
      <div class="mt-2 font-display text-2xl font-semibold leading-none tabular-nums md:text-3xl">
        {data.stats.allergens.introduced}
        <span class="text-base font-normal text-muted-foreground">/ {data.stats.allergens.total}</span>
      </div>
      <div class="mt-1 text-xs text-muted-foreground">{m.dashboardAllergensTestedLabel()}</div>
    </Card>
    <Card class="col-span-2 p-4 md:col-span-1">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <CalendarDays size={14} aria-hidden="true" />
        {m.dashboardWeekLabel()}
      </div>
      <div class="mt-2 font-display text-2xl font-semibold leading-none tabular-nums md:text-3xl">{data.stats.weekCount}</div>
      <div class="mt-1 text-xs text-muted-foreground">
        {weekCountLabel}
      </div>
    </Card>
  </section>

  {#if data.weeklyRecap.entries > 0}
    <Card class="border-l-2 border-l-celebrate p-4 md:p-5">
      <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-celebrate-foreground">
        <Sparkles size={12} class="text-celebrate" aria-hidden="true" />
        {m.dashboardWeeklyRecapLabel()}
      </div>
      <p class="mt-2 text-sm text-foreground/90">
        {weeklyRecapMealsLabel}
        {#if data.weeklyRecap.newFoods > 0}
          · <strong class="font-semibold text-foreground"
            >{weeklyRecapNewFoodsLabel}</strong
          >
        {/if}
        {#if data.weeklyRecap.newAllergens > 0}
          · <strong class="font-semibold text-foreground"
            >{weeklyRecapNewAllergensLabel}</strong
          >
        {/if}
      </p>
    </Card>
  {/if}

  {#if data.coparentActivity.length > 0}
    <Card class="p-4 md:p-5">
      <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Users size={12} aria-hidden="true" />
        {m.dashboardCoparentActivityLabel()}
      </div>
      <ul class="mt-2 divide-y">
        {#each data.coparentActivity as e (e.id)}
          <li class="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            <span class="flex min-w-0 items-baseline gap-1.5">
              <span class="truncate"
                ><strong class="font-medium">{e.loggedByName}</strong>
                <span class="text-muted-foreground"> · {e.foodName}</span></span
              >
              <ReactionBadge reaction={e.reaction} />
            </span>
            <span class="shrink-0 text-xs text-muted-foreground">
              {dayjs(e.givenAt).locale(languageTag()).fromNow()}
            </span>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}

  <Card class="p-4 md:p-5">
    <AllergenProgress summary={data.stats.allergens} />
  </Card>

  <DiversityCard metrics={data.diversity} />

  {#if rotatingTip}
    <TipCard
      tone="info"
      icon={Lightbulb}
      eyebrow={m.dashboardDailyTip()}
      body={rotatingTip.body}
      sources={rotatingTip.sources ? [...rotatingTip.sources] : undefined}
    />
  {/if}

  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold">{m.dashboardRecentMealsSection()}</h2>
      <a
        href={localizedHref(`/child/${data.child.id}/foods`)}
        class="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
      >
        {m.dashboardRecentMealsViewAll()}
      </a>
    </div>

    {#if data.recent.length === 0}
      <EmptyState
        icon={UtensilsCrossed}
        title={m.dashboardEmptyStateTitle()}
        description={m.dashboardEmptyStateDescription({ name: data.child.name })}
      >
        {#snippet action()}
          <Button href={localizedHref(`/child/${data.child.id}/log`)}>{m.dashboardEmptyStateLogCta()}</Button>
        {/snippet}
      </EmptyState>

      {#if data.starterFoods.length > 0}
        <Card class="p-4 md:p-5">
          <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles size={12} class="text-celebrate" aria-hidden="true" />
            {m.dashboardStarterFoodsLabel()}
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {m.dashboardStarterFoodsDescription({ name: data.child.name })}
          </p>
          <ul class="mt-3 grid gap-2 sm:grid-cols-2">
            {#each data.starterFoods as f (f.id)}
              <li>
                <a
                  href={localizedHref(`/child/${data.child.id}/log?foodId=${f.id}`)}
                  aria-label={`Noter ${f.name}, dès ${f.suggestedAgeMonths} mois`}
                  class="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span class="flex min-w-0 flex-1 items-center gap-2">
                    <CategoryTag id={f.category} size="sm" />
                    <span class="truncate font-medium">{f.name}</span>
                  </span>
                  <span class="shrink-0 text-xs text-muted-foreground">dès {f.suggestedAgeMonths} m</span>
                </a>
              </li>
            {/each}
          </ul>
        </Card>
      {/if}
    {:else if !mounted}
      <Card>
        <ul class="divide-y" aria-busy="true">
          {#each data.recent as e (e.id)}
            <li>
              <a
                href={localizedHref(`/child/${data.child.id}/log/${e.id}?from=dashboard`)}
                class="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none md:p-4"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate font-medium">{e.foodName}</span>
                    <ReactionBadge reaction={e.reaction} />
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>par {e.loggedByName}</span>
                    <CategoryTag id={e.category} size="sm" />
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
                {day.entries.length === 1
                  ? m.dashboardDayEntriesCountOne({ count: day.entries.length })
                  : m.dashboardDayEntriesCountOther({ count: day.entries.length })}
              </span>
            </div>
            <Card>
              <ul class="divide-y">
                {#each day.entries as e (e.id)}
                  <li>
                    <a
                      href={localizedHref(`/child/${data.child.id}/log/${e.id}?from=dashboard`)}
                      class="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none md:p-4"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="truncate font-medium">{e.foodName}</span>
                          <ReactionBadge reaction={e.reaction} />
                        </div>
                        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{dayjs(e.givenAt).format('HH:mm')} · par {e.loggedByName}</span>
                          <CategoryTag id={e.category} size="sm" />
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
      href={localizedHref(`/child/${data.child.id}/allergens`)}
      class="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card class="flex items-center justify-between p-4 transition-colors group-hover:bg-accent">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div>
            <div class="text-sm font-medium">{m.dashboardNavAllergensLabel()}</div>
            <div class="text-xs text-muted-foreground">{m.dashboardNavAllergensDescription()}</div>
          </div>
        </div>
        <ChevronRight size={18} class="text-muted-foreground" aria-hidden="true" />
      </Card>
    </a>
    <a
      href={localizedHref(`/child/${data.child.id}/suggestions`)}
      class="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card class="flex items-center justify-between p-4 transition-colors group-hover:bg-accent">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles size={18} aria-hidden="true" />
          </div>
          <div>
            <div class="text-sm font-medium">{m.dashboardNavSuggestionsLabel()}</div>
            <div class="text-xs text-muted-foreground">{m.dashboardNavSuggestionsDescription()}</div>
          </div>
        </div>
        <ChevronRight size={18} class="text-muted-foreground" aria-hidden="true" />
      </Card>
    </a>
    <a
      href={localizedHref(`/child/${data.child.id}/guide`)}
      class="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card class="flex items-center justify-between p-4 transition-colors group-hover:bg-accent">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          <div>
            <div class="text-sm font-medium">{m.dashboardNavGuideLabel()}</div>
            <div class="text-xs text-muted-foreground">{m.dashboardNavGuideDescription()}</div>
          </div>
        </div>
        <ChevronRight size={18} class="text-muted-foreground" aria-hidden="true" />
      </Card>
    </a>
  </section>

  <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
    <a
      href={localizedHref(`/child/${data.child.id}/settings`)}
      class="rounded text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {m.dashboardFooterSettingsLink()}
    </a>
    <span class="text-muted-foreground/40" aria-hidden="true">·</span>
    <a
      href={localizedHref(`/child/${data.child.id}/analytics`)}
      class="rounded text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {m.dashboardFooterAnalyticsLink()}
    </a>
    <span class="text-muted-foreground/40" aria-hidden="true">·</span>
    <a
      href={localizedHref(`/child/${data.child.id}/report`)}
      class="rounded text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {m.dashboardFooterReportLink()}
    </a>
  </div>
</div>
{/if}

<WelcomeDialog
  bind:open={welcomeOpen}
  childId={data.child.id}
  formAction="?/dismissReminder"
/>
