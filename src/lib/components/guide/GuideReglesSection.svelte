<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import { KEY_PRINCIPLES } from '$lib/content/guidance';
  import { Sparkles } from 'lucide-svelte';
</script>

<section id="regles" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <Sparkles size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Les 10 règles d'or</h2>
  </div>
  <div class="grid gap-3 sm:grid-cols-2">
    {#each KEY_PRINCIPLES as p (p.id)}
      <Card class="p-4">
        <h3 class="text-sm font-semibold">{p.title}</h3>
        <p class="mt-1 text-sm text-foreground/90">{p.body}</p>
        <div class="mt-2">
          <SourceCitation ids={[...p.sources]} inline />
        </div>
      </Card>
    {/each}
  </div>
</section>
