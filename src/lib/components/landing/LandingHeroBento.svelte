<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import BentoMark from '$lib/components/bento/BentoMark.svelte';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';

  let { child }: { child: { id: string; name: string } | null } = $props();
</script>

<section class="bg-tile-peach px-6 py-16 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <BentoMark size={48} class="mb-6" />
    <h1 class="font-display text-4xl italic leading-tight sm:text-5xl">
      {m.landingHeroTitle()}
    </h1>
    <p class="mt-4 max-w-xl text-base text-tile-peach-foreground">
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
          class="text-sm font-semibold text-primary-strong underline"
        >
          {m.landingHeroCtaLogin()}
        </a>
      {/if}
    </div>
  </div>
</section>
