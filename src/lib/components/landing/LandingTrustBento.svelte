<script lang="ts">
  import * as m from '#lib/paraglide/messages.js';
  import { EyeOff, BookOpen, Lock } from '@lucide/svelte';

  const PILLARS = [
    { icon: EyeOff, key: 'landingTrustPillarNoAnalytics' as const },
    { icon: BookOpen, key: 'landingTrustPillarSources' as const },
    { icon: Lock, key: 'landingTrustPillarOwnership' as const }
  ];
</script>

<!-- The section sets the sky tint's own foreground for its title. Each pillar
     paints white and sets ink back, so it does not inherit the navy. -->
<section class="bg-tile-sky px-6 py-14 text-tile-sky-foreground sm:px-10">
  <div class="mx-auto max-w-3xl">
    <h2 class="font-display text-2xl italic">
      {m.landingTrustTitle()}
    </h2>
    <ul class="mt-6 grid gap-3 sm:grid-cols-3">
      {#each PILLARS as p (p.key)}
        <li class="flex items-start gap-3 rounded-tile bg-surface p-4 text-foreground shadow-soft">
          <p.icon size={18} class="mt-0.5 text-primary" aria-hidden="true" />
          <span class="text-sm font-bold leading-tight">{m[p.key]()}</span>
        </li>
      {/each}
    </ul>
  </div>
</section>
