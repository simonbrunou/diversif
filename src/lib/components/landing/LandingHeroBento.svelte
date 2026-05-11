<script lang="ts">
  import BentoMark from '$lib/components/bento/BentoMark.svelte';
  import { localizedHref } from '$lib/utils/localized-href';

  let { child }: { child: { id: string; name: string } | null } = $props();
</script>

<section class="bg-tile-peach px-6 py-16 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <BentoMark size={48} class="mb-6" />
    <h1 class="font-display text-4xl italic leading-tight sm:text-5xl">
      Diversifier en confiance, à votre rythme.
    </h1>
    <p class="mt-4 max-w-xl text-base text-tile-peach-foreground">
      Un carnet calme pour suivre l'introduction des aliments, à deux parents si vous voulez. Sans
      télémétrie, avec des sources scientifiques citées.
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-3">
      {#if child}
        <a
          href={localizedHref(`/child/${child.id}`)}
          class="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft"
        >
          Continuer avec {child.name}
        </a>
      {:else}
        <a
          href={localizedHref('/signup')}
          class="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft"
        >
          Créer mon compte
        </a>
        <a
          href={localizedHref('/login')}
          class="text-sm font-semibold text-primary underline"
        >
          Se connecter
        </a>
      {/if}
    </div>
  </div>
</section>
