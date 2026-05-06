<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { Activity, Flame, Sparkles } from 'lucide-svelte';
  import dayjs from 'dayjs';
  import 'dayjs/locale/fr';
  import type { PageData } from './$types';

  dayjs.locale('fr');

  let { data }: { data: PageData } = $props();

  // Numeric maxes — pre-computed once so each bar can normalize against the
  // tallest value in its own series, keeping silhouettes meaningful even if
  // one series dwarfs the others.
  const maxIntro = $derived(Math.max(1, ...data.buckets.map((b) => b.introductions)));
  const maxReactions = $derived(
    Math.max(
      1,
      ...data.buckets.map((b) => b.reactions.ras + b.reactions.inconfort + b.reactions.reaction)
    )
  );

  const totalIntros = $derived(data.buckets.reduce((s, b) => s + b.introductions, 0));
  const totalEntries = $derived(
    data.buckets.reduce(
      (s, b) => s + b.reactions.ras + b.reactions.inconfort + b.reactions.reaction,
      0
    )
  );
  const lastBucket = $derived(data.buckets[data.buckets.length - 1]);

  function weekLabel(ts: number): string {
    return dayjs(ts).format('D MMM');
  }
</script>

<div class="container max-w-3xl space-y-6 py-6 md:py-8">
  <header class="space-y-1">
    <a
      href={`/child/${data.child.id}`}
      class="text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      ← Tableau
    </a>
    <div class="mt-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80">
      <Activity size={14} aria-hidden="true" />
      Tendances · {data.weeks} dernières semaines
    </div>
    <h1 class="font-display text-2xl font-semibold leading-tight md:text-3xl">
      L'évolution de {data.child.name}
    </h1>
  </header>

  <!-- Summary -->
  <section class="grid grid-cols-2 gap-3 md:grid-cols-3">
    <Card class="p-4">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles size={14} aria-hidden="true" />
        Nouveautés
      </div>
      <div class="mt-2 font-display text-2xl font-semibold leading-none tabular-nums md:text-3xl">
        {totalIntros}
      </div>
      <div class="mt-1 text-xs text-muted-foreground">aliments découverts</div>
    </Card>
    <Card class="p-4">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Activity size={14} aria-hidden="true" />
        Repas
      </div>
      <div class="mt-2 font-display text-2xl font-semibold leading-none tabular-nums md:text-3xl">
        {totalEntries}
      </div>
      <div class="mt-1 text-xs text-muted-foreground">notés sur la période</div>
    </Card>
    <Card class="col-span-2 p-4 md:col-span-1">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Flame size={14} aria-hidden="true" />
        Diversité
      </div>
      <div class="mt-2 font-display text-2xl font-semibold leading-none tabular-nums md:text-3xl">
        {lastBucket?.cumulativeCategories ?? 0}<span class="text-base font-normal text-muted-foreground"
          >/ {data.totalCategories}</span
        >
      </div>
      <div class="mt-1 text-xs text-muted-foreground">familles couvertes</div>
    </Card>
  </section>

  <!-- Introductions per week -->
  <Card class="p-4 md:p-5">
    <h2 class="text-sm font-semibold">Nouveaux aliments par semaine</h2>
    <p class="mt-0.5 text-xs text-muted-foreground">
      Compte des aliments introduits pour la première fois.
    </p>
    <div class="mt-4 grid grid-cols-12 items-end gap-1.5" aria-hidden="true">
      {#each data.buckets as b, i (i)}
        <div class="flex h-24 flex-col items-stretch justify-end">
          <div
            class="rounded-t-sm bg-primary/70"
            style="height: {(b.introductions / maxIntro) * 100}%"
          ></div>
        </div>
      {/each}
    </div>
    <div class="mt-1 grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground">
      {#each data.buckets as b, i (i)}
        <div class="text-center">
          {#if i % 2 === 0}
            {weekLabel(b.weekStart)}
          {/if}
        </div>
      {/each}
    </div>
    <table class="sr-only">
      <caption>Nouveaux aliments par semaine</caption>
      <thead><tr><th>Semaine du</th><th>Aliments</th></tr></thead>
      <tbody>
        {#each data.buckets as b, i (i)}
          <tr>
            <td>{weekLabel(b.weekStart)}</td>
            <td>{b.introductions}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>

  <!-- Reactions stacked per week -->
  <Card class="p-4 md:p-5">
    <h2 class="text-sm font-semibold">Réactions par semaine</h2>
    <p class="mt-0.5 text-xs text-muted-foreground">
      Bien toléré, petit inconfort, réaction marquée.
    </p>
    <div class="mt-4 grid grid-cols-12 items-end gap-1.5" aria-hidden="true">
      {#each data.buckets as b, i (i)}
        {@const total = b.reactions.ras + b.reactions.inconfort + b.reactions.reaction}
        <div class="flex h-24 flex-col items-stretch justify-end">
          {#if total > 0}
            {#if b.reactions.reaction > 0}
              <div
                class="rounded-t-sm bg-reaction-reaction"
                style="height: {(b.reactions.reaction / maxReactions) * 100}%"
              ></div>
            {/if}
            {#if b.reactions.inconfort > 0}
              <div
                class={b.reactions.reaction === 0 ? 'rounded-t-sm bg-reaction-inconfort' : 'bg-reaction-inconfort'}
                style="height: {(b.reactions.inconfort / maxReactions) * 100}%"
              ></div>
            {/if}
            {#if b.reactions.ras > 0}
              <div
                class={b.reactions.reaction === 0 && b.reactions.inconfort === 0
                  ? 'rounded-t-sm bg-reaction-ras'
                  : 'bg-reaction-ras'}
                style="height: {(b.reactions.ras / maxReactions) * 100}%"
              ></div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
    <div class="mt-1 grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground">
      {#each data.buckets as b, i (i)}
        <div class="text-center">
          {#if i % 2 === 0}
            {weekLabel(b.weekStart)}
          {/if}
        </div>
      {/each}
    </div>
    <ul class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <li class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-reaction-ras" aria-hidden="true"></span>
        Bien toléré
      </li>
      <li class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-reaction-inconfort" aria-hidden="true"></span>
        Petit inconfort
      </li>
      <li class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-reaction-reaction" aria-hidden="true"></span>
        Réaction marquée
      </li>
    </ul>
    <table class="sr-only">
      <caption>Réactions par semaine</caption>
      <thead>
        <tr>
          <th>Semaine du</th>
          <th>Bien toléré</th>
          <th>Petit inconfort</th>
          <th>Réaction marquée</th>
        </tr>
      </thead>
      <tbody>
        {#each data.buckets as b, i (i)}
          <tr>
            <td>{weekLabel(b.weekStart)}</td>
            <td>{b.reactions.ras}</td>
            <td>{b.reactions.inconfort}</td>
            <td>{b.reactions.reaction}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>

  <!-- Cumulative categories curve -->
  <Card class="p-4 md:p-5">
    <h2 class="text-sm font-semibold">Familles alimentaires couvertes</h2>
    <p class="mt-0.5 text-xs text-muted-foreground">
      Cumul à la fin de chaque semaine, sur {data.totalCategories} familles.
    </p>
    <div class="mt-4 grid grid-cols-12 items-end gap-1.5" aria-hidden="true">
      {#each data.buckets as b, i (i)}
        <div class="flex h-24 flex-col items-stretch justify-end">
          <div
            class="rounded-t-sm bg-accent-mint"
            style="height: {(b.cumulativeCategories / data.totalCategories) * 100}%"
          ></div>
        </div>
      {/each}
    </div>
    <div class="mt-1 grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground">
      {#each data.buckets as b, i (i)}
        <div class="text-center">
          {#if i % 2 === 0}
            {weekLabel(b.weekStart)}
          {/if}
        </div>
      {/each}
    </div>
    <table class="sr-only">
      <caption>Familles couvertes au fil du temps</caption>
      <thead><tr><th>Semaine du</th><th>Familles</th></tr></thead>
      <tbody>
        {#each data.buckets as b, i (i)}
          <tr>
            <td>{weekLabel(b.weekStart)}</td>
            <td>{b.cumulativeCategories}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Card>
</div>
