<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { formatRelative } from '$lib/utils/dates';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const introduced = $derived(data.allergens.filter((a: { introduced: boolean }) => a.introduced).length);
</script>

<div class="container max-w-2xl space-y-5 py-6">
  <header>
    <a href={`/child/${data.child.id}`} class="text-sm text-muted-foreground hover:underline">
      ← Tableau
    </a>
    <h1 class="mt-2 text-xl font-semibold">Allergènes</h1>
    <p class="text-sm text-muted-foreground">
      {introduced} sur {data.allergens.length} introduits
    </p>
  </header>

  <div class="grid gap-3 sm:grid-cols-2">
    {#each data.allergens as a (a.id)}
      <a href={`/child/${data.child.id}/foods?q=${encodeURIComponent(a.label)}`}>
        <Card class="p-4 transition-colors hover:bg-accent">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-medium">{a.label}</div>
              {#if a.introduced && a.firstIntroAt}
                <div class="mt-0.5 text-xs text-muted-foreground">
                  1ʳᵉ introduction · {formatRelative(a.firstIntroAt)}
                </div>
                <div class="text-xs text-muted-foreground">
                  {a.count} exposition{a.count > 1 ? 's' : ''}
                </div>
              {:else}
                <div class="mt-0.5 text-xs text-muted-foreground">Pas encore introduit</div>
              {/if}
            </div>
            <span
              class={a.introduced
                ? 'rounded-full bg-reaction-ras/15 px-2 py-0.5 text-[11px] font-medium text-reaction-ras'
                : 'rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}
            >
              {a.introduced ? 'Introduit' : 'À tester'}
            </span>
          </div>
        </Card>
      </a>
    {/each}
  </div>
</div>
