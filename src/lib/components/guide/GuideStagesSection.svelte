<script lang="ts">
  import Badge from '$components/ui/Badge.svelte';
  import StageBadge from '$lib/components/StageBadge.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import { STAGES, type StageId } from '$lib/content/guidance';
  import { Layers, AlertTriangle } from 'lucide-svelte';

  let { currentStageId = null }: { currentStageId?: StageId | null } = $props();
</script>

<section id="etapes" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <Layers size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Les 4 étapes</h2>
  </div>
  <div class="space-y-3">
    {#each STAGES as s (s.id)}
      <details class="group rounded-lg border bg-card" open={s.id === currentStageId}>
        <summary class="flex cursor-pointer items-start justify-between gap-3 p-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <StageBadge stage={s} />
              {#if s.id === currentStageId}
                <Badge variant="default">Actuelle</Badge>
              {/if}
            </div>
            <h3 class="mt-2 text-base font-semibold">{s.title}</h3>
            <p class="mt-1 text-sm text-muted-foreground">{s.oneLiner}</p>
          </div>
        </summary>
        <div class="space-y-4 border-t p-4 text-sm">
          <div>
            <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Principes
            </h4>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              {#each s.principles as p, i (i)}
                <li>{p}</li>
              {/each}
            </ul>
          </div>
          <div>
            <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Aliments à proposer
            </h4>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              {#each s.focus as p, i (i)}
                <li>{p}</li>
              {/each}
            </ul>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-md border bg-muted/40 p-3">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Texture
              </div>
              <p class="mt-1">{s.textures}</p>
            </div>
            <div class="rounded-md border bg-muted/40 p-3">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lait
              </div>
              <p class="mt-1">{s.milkTarget}</p>
            </div>
          </div>
          {#if s.redFlags.length > 0}
            <div class="rounded-md border border-reaction-inconfort/30 bg-reaction-inconfort/5 p-3">
              <div
                class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-inconfort-foreground"
              >
                <AlertTriangle size={12} aria-hidden="true" />
                À surveiller
              </div>
              <ul class="mt-1 list-disc space-y-1 pl-5">
                {#each s.redFlags as f, i (i)}
                  <li>{f}</li>
                {/each}
              </ul>
            </div>
          {/if}
          <SourceCitation ids={[...s.sources]} inline />
        </div>
      </details>
    {/each}
  </div>
</section>
