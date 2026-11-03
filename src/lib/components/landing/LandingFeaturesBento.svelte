<script lang="ts">
  import * as m from '#lib/paraglide/messages.js';
  import { Apple, Clock, ShieldCheck, BookOpen } from '@lucide/svelte';

  const features = $derived([
    {
      tile: 'bg-tile-mint',
      // Body copy takes the tile's own ink (DESIGN.md, The Paired Foreground Rule).
      fg: 'text-tile-mint-foreground',
      icon: Apple,
      title: m.landingFeatureCarnetTitle(),
      body: m.landingFeatureCarnetBody()
    },
    {
      tile: 'bg-tile-butter',
      fg: 'text-tile-butter-foreground',
      icon: Clock,
      title: m.landingFeatureAllergensTitle(),
      body: m.landingFeatureAllergensBody()
    },
    {
      tile: 'bg-tile-sky',
      fg: 'text-tile-sky-foreground',
      icon: ShieldCheck,
      title: m.landingFeatureCoparentsTitle(),
      body: m.landingFeatureCoparentsBody()
    },
    {
      tile: 'bg-tile-lilac',
      fg: 'text-tile-lilac-foreground',
      icon: BookOpen,
      title: m.landingFeatureGuideTitle(),
      body: m.landingFeatureGuideBody()
    }
  ]);
</script>

<section class="bg-canvas px-6 py-14 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <h2 class="font-display text-2xl italic">{m.landingFeaturesTitle()}</h2>
    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      {#each features as f, i (i)}
        <article class="rounded-tile {f.tile} p-5 shadow-soft">
          <f.icon size={20} class="text-ink" aria-hidden="true" />
          <h3 class="mt-3 text-base font-bold leading-tight">{f.title}</h3>
          <p class="mt-1 text-sm {f.fg}">{f.body}</p>
        </article>
      {/each}
    </div>
  </div>
</section>
