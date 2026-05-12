<script lang="ts">
  import { SOURCES, ALL_SOURCE_IDS } from '$lib/content/sources';
  import { localizedHref } from '$lib/utils/localized-href';

  const orgs = ALL_SOURCE_IDS.map((id) => SOURCES[id].org);
  const uniqueOrgs = Array.from(new Set(orgs));
</script>

<section class="border-y bg-surface">
  <div class="container max-w-4xl py-12 text-center md:py-16">
    <h2 class="text-2xl font-semibold md:text-3xl">Adossé à 10 sources qui font autorité</h2>
    <p class="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
      Diversif ne remplace pas votre pédiatre — il s'appuie sur les mêmes recommandations que lui.
    </p>
    <ul class="mt-6 flex flex-wrap items-center justify-center gap-2">
      {#each uniqueOrgs as org (org)}
        <li>
          <a
            href={localizedHref('/sources')}
            class="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {org}
          </a>
        </li>
      {/each}
    </ul>
    <p class="mt-6 text-sm">
      <a
        href={localizedHref('/sources')}
        class="font-medium text-primary-strong underline-offset-4 hover:underline"
      >
        Voir toutes les sources →
      </a>
    </p>
  </div>
</section>
