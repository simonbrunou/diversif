<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import { APPROACHES } from '$lib/content/guidance';
  import { Users } from 'lucide-svelte';
</script>

<section id="approches" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <Users size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Classique, DME, mixte</h2>
  </div>
  <div class="grid gap-3 md:grid-cols-3">
    {#each Object.entries(APPROACHES) as [key, a] (key)}
      <Card class="p-4">
        <h3 class="text-sm font-semibold">{a.title}</h3>
        <p class="mt-1 text-sm text-foreground/90">{a.body}</p>
        <h4 class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-ras-foreground">
          Avantages
        </h4>
        <ul class="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {#each a.pros as p, i (i)}
            <li>{p}</li>
          {/each}
        </ul>
        <h4 class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-inconfort-foreground">
          Limites
        </h4>
        <ul class="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {#each a.cons as p, i (i)}
            <li>{p}</li>
          {/each}
        </ul>
        <div class="mt-2">
          <SourceCitation ids={[...a.sources]} inline />
        </div>
      </Card>
    {/each}
  </div>
</section>
