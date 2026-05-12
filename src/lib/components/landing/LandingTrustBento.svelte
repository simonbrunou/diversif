<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { EyeOff, BookOpen, Lock } from 'lucide-svelte';

  const PILLARS = [
    { icon: EyeOff, key: 'landingTrustPillarNoTelemetry' as const },
    { icon: BookOpen, key: 'landingTrustPillarSources' as const },
    { icon: Lock, key: 'landingTrustPillarOwnership' as const }
  ];
</script>

<section class="bg-tile-sky px-6 py-14 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <h2 class="font-display text-2xl italic text-tile-sky-foreground">
      {m.landingTrustTitle()}
    </h2>
    <ul class="mt-6 grid gap-3 sm:grid-cols-3">
      {#each PILLARS as p (p.key)}
        <li class="flex items-start gap-3 rounded-tile bg-surface p-4 shadow-soft">
          <p.icon size={18} class="mt-0.5 text-primary" aria-hidden="true" />
          <span class="text-sm font-bold leading-tight">{m[p.key]()}</span>
        </li>
      {/each}
    </ul>
  </div>
</section>
