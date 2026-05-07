<script lang="ts">
  import * as m from '$lib/paraglide/messages';

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
      <a href="/guide" class="hover:text-foreground hover:underline">{m.chromePublicFooterGuide()}</a>
      <a href="/allergens" class="hover:text-foreground hover:underline">{m.chromePublicFooterAllergens()}</a>
      <a href="/sources" class="hover:text-foreground hover:underline">{m.chromePublicFooterSources()}</a>
      <a href="/login" class="hover:text-foreground hover:underline">{m.chromePublicFooterLogin()}</a>
      <a href="/mentions-legales" class="hover:text-foreground hover:underline">{m.chromePublicFooterMentionsLegales()}</a>
      <a href="/politique-confidentialite" class="hover:text-foreground hover:underline">{m.chromePublicFooterPolitiqueConfidentialite()}</a>
      <a href="/cgu" class="hover:text-foreground hover:underline">{m.chromePublicFooterCGU()}</a>
      <a href="/cookies" class="hover:text-foreground hover:underline">{m.chromePublicFooterCookies()}</a>
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
