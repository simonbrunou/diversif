<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { Apple, Clock, ShieldCheck, BookOpen } from 'lucide-svelte';

  const FEATURES = [
    {
      tile: 'bg-tile-mint',
      icon: Apple,
      title: "Carnet d'aliments",
      body: 'Notez chaque essai en 4 taps, suivez ce qui a été tenté et ce qui reste à découvrir.'
    },
    {
      tile: 'bg-tile-butter',
      icon: Clock,
      title: 'Allergènes prioritaires',
      body: '14 allergènes suivis selon les recommandations HCSP, LEAP et EAT.'
    },
    {
      tile: 'bg-tile-sky',
      icon: ShieldCheck,
      title: 'Co-parents',
      body: 'Partagez le suivi avec votre partenaire ou un proche, sans copier-coller.'
    },
    {
      tile: 'bg-tile-lilac',
      icon: BookOpen,
      title: 'Guide par étape',
      body: "Conseils contextualisés selon l'âge — toujours avec leurs sources citées."
    }
  ];
</script>

<section class="bg-canvas px-6 py-14 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <h2 class="font-display text-2xl italic">{m.landingFeaturesTitle()}</h2>
    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      {#each FEATURES as f, i (i)}
        <article class="rounded-tile {f.tile} p-5 shadow-soft">
          <f.icon size={20} class="text-ink" aria-hidden="true" />
          <h3 class="mt-3 text-base font-bold leading-tight">{f.title}</h3>
          <p class="mt-1 text-sm text-ink-soft">{f.body}</p>
        </article>
      {/each}
    </div>
  </div>
</section>
