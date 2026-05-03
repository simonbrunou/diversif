<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import { formatRelative } from '$lib/utils/dates';
  import type { AllergenId } from '$lib/utils/allergens';
  import { Info, ShieldCheck } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const introduced = $derived(data.allergens.filter((a: { introduced: boolean }) => a.introduced).length);

  let openAllergenId = $state<AllergenId | null>(null);
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

  <TipCard
    tone="info"
    icon={ShieldCheck}
    eyebrow="Pourquoi tôt"
    title="Introduire les allergènes dès la diversification"
    body="Les recommandations actuelles préconisent d'introduire les allergènes (œuf, arachide en purée, lait, gluten…) sans tarder, dès que la diversification est lancée. L'étude LEAP a montré que l'introduction précoce de l'arachide réduit jusqu'à 86 % le risque d'allergie."
    sources={['leap-2015', 'eat-2016', 'espghan-2017', 'hcsp-2020']}
  />

  <div class="grid gap-3 sm:grid-cols-2">
    {#each data.allergens as a (a.id)}
      <Card class="p-4 transition-colors hover:bg-accent/50">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <a
                href={`/child/${data.child.id}/foods?q=${encodeURIComponent(a.label)}`}
                class="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                {a.label}
              </a>
              <button
                type="button"
                onclick={() => (openAllergenId = a.id as AllergenId)}
                class="rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Plus d'informations sur {a.label}"
                title="Plus d'infos"
              >
                <Info size={14} aria-hidden="true" />
              </button>
            </div>
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
          <Badge variant={a.introduced ? 'ras' : 'secondary'}>
            {a.introduced ? 'Introduit' : 'À tester'}
          </Badge>
        </div>
      </Card>
    {/each}
  </div>
</div>

<AllergenInfoDialog bind:allergenId={openAllergenId} />
