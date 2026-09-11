<script lang="ts">
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import type { TextureKey } from '$lib/utils/textures';
  import type { Stage } from '$lib/content/guidance';
  import * as m from '$lib/paraglide/messages';

  let {
    ageMonths,
    stage,
    mostAdvancedTexture
  }: {
    ageMonths: number;
    stage: Stage;
    mostAdvancedTexture: TextureKey | null;
  } = $props();
</script>

<section class="space-y-2 rounded-lg border bg-card p-4">
  <h2 class="text-lg font-semibold">{m.reportStageHeading()}</h2>
  {#if ageMonths < 4}
    <p class="text-sm text-muted-foreground">{m.preDiversificationTitle()}</p>
    <p class="text-sm">{m.preDiversificationBody()}</p>
  {:else}
    <p class="text-sm text-muted-foreground">{stage.title}</p>
    <p class="text-sm">{stage.oneLiner}</p>
    <p class="text-sm">
      <span class="text-muted-foreground">{m.reportStageExpectedTextures()} : </span>{stage.textures}
    </p>
  {/if}
  {#if mostAdvancedTexture}
    <p class="text-sm">
      <span class="text-muted-foreground">{m.reportStageMostAdvancedTexture()} : </span>
      {getTextureLabel(mostAdvancedTexture)}
    </p>
  {/if}
</section>
