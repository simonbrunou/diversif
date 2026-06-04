<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';

  const year = new Date().getFullYear();
</script>

<footer class="mt-12 border-t bg-surface">
  <div class="container grid gap-6 py-8 text-sm text-muted-foreground md:grid-cols-[1fr_auto] md:items-start">
    <div class="space-y-2">
      <div class="flex items-center gap-2 font-semibold text-foreground">
        <img src="/favicon.svg" alt="" class="h-5 w-5" aria-hidden="true" />
        Diversif
      </div>
      <p class="max-w-md text-xs">
        {m.chromePublicFooterDisclaimer()}
      </p>
      <p class="text-xs">{m.chromePublicFooterCopyright({ year })}</p>
    </div>

    <nav aria-label={m.chromePublicFooterLabel()} class="grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-1">
      <a href={localizedHref('/guide')} class="hover:text-foreground hover:underline">{m.chromePublicNavGuide()}</a>
      <a href={localizedHref('/allergens')} class="hover:text-foreground hover:underline">{m.chromePublicNavAllergens()}</a>
      <a href={localizedHref('/sources')} class="hover:text-foreground hover:underline">{m.chromePublicNavSources()}</a>
      <a href={localizedHref('/aide')} class="hover:text-foreground hover:underline">{m.aideNavLabel()}</a>
      <a href={localizedHref('/login')} class="hover:text-foreground hover:underline">{m.chromePublicNavLogin()}</a>
      <a href={localizedHref('/mentions-legales')} class="hover:text-foreground hover:underline">{m.chromePublicFooterMentionsLegales()}</a>
      <a href={localizedHref('/politique-confidentialite')} class="hover:text-foreground hover:underline">{m.chromePublicFooterPolitiqueConfidentialite()}</a>
      <a href={localizedHref('/cgu')} class="hover:text-foreground hover:underline">{m.chromePublicFooterCGU()}</a>
      <a href={localizedHref('/cookies')} class="hover:text-foreground hover:underline">{m.chromePublicFooterCookies()}</a>
      <a
        href="https://github.com/simonbrunou/diversif"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-foreground hover:underline"
      >
        GitHub
      </a>
    </nav>
  </div>
</footer>
