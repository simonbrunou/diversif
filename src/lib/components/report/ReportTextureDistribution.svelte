<script lang="ts">
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import { TEXTURE_VALUES, type TextureKey } from '$lib/utils/textures';
  import * as m from '$lib/paraglide/messages';

  let {
    textureDistribution
  }: {
    textureDistribution: {
      totalWithTexture: number;
      counts: Record<TextureKey, number>;
    };
  } = $props();
</script>

<section class="space-y-2 rounded-lg border bg-card p-4">
  <h2 class="text-lg font-semibold">{m.reportTextureDistributionHeading()}</h2>
  {#if textureDistribution.totalWithTexture === 0}
    <p class="text-sm text-muted-foreground">{m.reportTextureDistributionEmpty()}</p>
  {:else}
    <ul class="space-y-1.5">
      {#each TEXTURE_VALUES as k (k)}
        {@const n = textureDistribution.counts[k]}
        {@const pct = Math.round((n / textureDistribution.totalWithTexture) * 100)}
        <li class="grid grid-cols-[10ch_1fr_3ch] items-center gap-2 text-sm">
          <span class="text-muted-foreground">{getTextureLabel(k)}</span>
          <span class="h-2 rounded-full bg-muted">
            <span class="block h-2 rounded-full bg-foreground/70" style="width: {pct}%"></span>
          </span>
          <span class="text-right tabular-nums">{n}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
