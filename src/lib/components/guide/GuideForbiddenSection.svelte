<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import { FORBIDDEN_FOODS } from '$lib/content/guidance';
  import { AlertTriangle } from 'lucide-svelte';
</script>

<section id="eviter" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <AlertTriangle size={18} class="text-reaction-inconfort" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Aliments à éviter</h2>
  </div>
  <Card class="overflow-hidden">
    <ul class="divide-y">
      {#each FORBIDDEN_FOODS as f (f.id)}
        <li class="grid gap-1 p-4 md:grid-cols-[1fr_auto]">
          <div>
            <h3 class="text-sm font-semibold">{f.name}</h3>
            <p class="mt-1 text-sm text-foreground/90">{f.reason}</p>
            <div class="mt-1.5">
              <SourceCitation ids={[...f.sources]} inline />
            </div>
          </div>
          <Badge variant="inconfort" class="self-start whitespace-nowrap">{f.until}</Badge>
        </li>
      {/each}
    </ul>
  </Card>
</section>
