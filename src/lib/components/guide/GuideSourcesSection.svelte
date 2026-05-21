<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { SOURCES, ALL_SOURCE_IDS } from '$lib/content/sources';
  import { Library, ExternalLink } from 'lucide-svelte';
</script>

<section id="sources" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <Library size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Sources et références</h2>
  </div>
  <Card class="p-4">
    <p class="text-sm text-foreground/90">
      Toutes les recommandations affichées dans Diversif s'appuient sur des sources publiques et
      vérifiables : institutionnelles (HCSP, Santé publique France, ANSES, OMS), sociétés savantes
      (ESPGHAN, Société Française de Pédiatrie) et études cliniques de référence (LEAP, EAT). En
      cas de doute, consultez votre pédiatre.
    </p>
    <ul class="mt-3 space-y-2">
      {#each ALL_SOURCE_IDS as id (id)}
        {@const s = SOURCES[id]}
        <li class="rounded-md border bg-background p-3">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-start gap-1.5 rounded text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span>{s.label}</span>
            <ExternalLink size={12} class="mt-1 shrink-0" aria-hidden="true" />
          </a>
          <div class="mt-0.5 text-xs text-muted-foreground">{s.org} · {s.year}</div>
        </li>
      {/each}
    </ul>
  </Card>

  <p class="text-center text-xs text-muted-foreground">
    Diversif n'est pas un avis médical individuel. En cas de doute sur l'introduction d'un aliment,
    demandez conseil à votre pédiatre ou à un allergologue.
  </p>
</section>
