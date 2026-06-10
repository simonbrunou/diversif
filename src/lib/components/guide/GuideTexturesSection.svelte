<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { TEXTURE_PROGRESSION, CHOKING_HAZARDS } from '$lib/content/guidance';
  import { Layers, AlertTriangle } from 'lucide-svelte';
</script>

<section id="textures" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <Layers size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Textures et morceaux</h2>
  </div>
  <Card class="overflow-hidden">
    <ul class="divide-y">
      {#each TEXTURE_PROGRESSION as t, i (i)}
        <li class="grid gap-2 p-4 md:grid-cols-[80px_1fr]">
          <div class="text-sm font-semibold text-primary-strong">~ {t.ageMonths} mois</div>
          <div>
            <p class="text-sm font-medium">{t.texture}</p>
            {#if t.examples.length > 0}
              <p class="mt-1 text-xs text-muted-foreground">
                <span class="font-medium text-foreground/80">Exemples :</span>
                {t.examples.join(', ')}
              </p>
            {/if}
            {#if t.markers.length > 0}
              <p class="mt-1 text-xs text-muted-foreground">
                <span class="font-medium text-foreground/80">Signes de progression :</span>
                {t.markers.join(' · ')}
              </p>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </Card>

  <Card class="border-reaction-inconfort/30 bg-reaction-inconfort/5 p-4">
    <h3 class="flex items-center gap-2 text-sm font-semibold text-reaction-inconfort-foreground">
      <AlertTriangle size={14} aria-hidden="true" />
      Étouffement : règles de découpe
    </h3>
    <ul class="mt-2 grid gap-1 text-sm text-foreground/90 sm:grid-cols-2">
      {#each CHOKING_HAZARDS as c, i (i)}
        <li><strong>{c.food}</strong> : {c.rule}</li>
      {/each}
    </ul>
    <p class="mt-3 text-xs text-muted-foreground">
      Bébé mange toujours <strong>assis bien droit</strong>, dans une chaise haute adaptée,
      <strong>jamais seul</strong>, jamais en voiture, ni en poussette, ni allongé.
    </p>
  </Card>
</section>
