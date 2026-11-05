<script lang="ts">
  import Button from '#lib/components/ui/Button.svelte';
  import BentoMark from '#lib/components/bento/BentoMark.svelte';
  import { localizedHref } from '#lib/utils/localized-href.js';
  import * as m from '#lib/paraglide/messages.js';

  let { child }: { child: { id: string; name: string } | null } = $props();
</script>

<!-- The hero, its title and the login link take the peach tint's own
     foreground (DESIGN.md, The Paired Foreground Rule): the link keeps its
     underline as its action cue, as a tile button keeps the tint's pairing. -->
<section class="bg-tile-peach px-6 py-16 text-tile-peach-foreground sm:px-10">
  <div class="mx-auto max-w-3xl">
    <BentoMark size={48} class="mb-6" />
    <h1 class="font-display text-4xl italic leading-tight sm:text-5xl">
      {m.landingHeroTitle()}
    </h1>
    <p class="mt-4 max-w-xl text-base">
      {m.landingHeroBody()}
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-3">
      {#if child}
        <Button
          href={localizedHref(`/child/${child.id}`)}
          size="pill"
          class="shadow-soft"
        >
          {m.landingHeroCtaContinue({ name: child.name })}
        </Button>
      {:else}
        <Button
          href={localizedHref('/signup')}
          size="pill"
          class="shadow-soft"
        >
          {m.landingHeroCtaCreateAccount()}
        </Button>
        <a
          href={localizedHref('/login')}
          class="text-sm font-semibold underline"
        >
          {m.landingHeroCtaLogin()}
        </a>
      {/if}
    </div>
  </div>
</section>
