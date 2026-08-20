<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import { CATEGORY_GUIDANCE } from '$lib/content/guidance';
  import { CATEGORIES } from '$lib/utils/categories';
  import { UtensilsCrossed } from 'lucide-svelte';
</script>

<section id="categories" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <UtensilsCrossed size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Groupes alimentaires</h2>
  </div>
  <div class="grid gap-3 sm:grid-cols-2">
    {#each CATEGORIES as c (c.id)}
      {#if c.id !== 'autre'}
        {@const g = CATEGORY_GUIDANCE[c.id]}
        <Card class="p-4">
          <h3 class="text-sm font-semibold">{c.label}</h3>
          <p class="mt-1 text-sm text-foreground/90">{g.why}</p>
          <dl class="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            <div>
              <dt class="inline font-medium text-foreground/80">Quand :</dt>
              <dd class="inline">{g.whenStart}</dd>
            </div>
            <div>
              <dt class="inline font-medium text-foreground/80">Fréquence :</dt>
              <dd class="inline">{g.cadence}</dd>
            </div>
            {#if g.examples.length > 0}
              <div>
                <dt class="inline font-medium text-foreground/80">Exemples :</dt>
                <dd class="inline">{g.examples.join(', ')}</dd>
              </div>
            {/if}
          </dl>
          {#if g.sources.length > 0}
            <div class="mt-2">
              <SourceCitation ids={[...g.sources]} inline />
            </div>
          {/if}
        </Card>
      {/if}
    {/each}
  </div>
</section>
