<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { languageTag, availableLanguageTags } from '$lib/paraglide/runtime';
  import { i18n } from '$lib/i18n';
  import * as m from '$lib/paraglide/messages';

  const labels: Record<string, string> = { fr: 'FR', en: 'EN' };

  // resolveRoute expects the canonical (unprefixed) path. The visible
  // pathname carries the /en prefix on English pages, so pass it through
  // and resolveRoute would treat /en/login as the route — producing
  // /en/login for FR (no flip) and /en/en/login for EN (doubled prefix).
  const canonicalPath = $derived(page.url.pathname.replace(/^\/en(?=\/|$)/, '') || '/');

  // page.url.search / .hash throw during prerender (SvelteKit disallows dynamic
  // URL access on prerendered pages). The locale switcher doesn't need to
  // preserve query strings on prerendered pages, so we fall back to empty strings.
  const urlSuffix = $derived(browser ? page.url.search + page.url.hash : '');
</script>

<nav class="locale-switcher" aria-label={m.chromeLocaleSwitcherLabel()}>
  {#each availableLanguageTags as locale}
    <a
      href={i18n.resolveRoute(canonicalPath, locale) + urlSuffix}
      data-active={languageTag() === locale ? 'true' : undefined}
      hreflang={locale}
      lang={locale}
    >
      {labels[locale] ?? locale.toUpperCase()}
    </a>
  {/each}
</nav>

<style>
  .locale-switcher {
    display: inline-flex;
    gap: 0.25rem;
    font-size: 0.75rem;
  }
  .locale-switcher a {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    color: hsl(var(--muted-foreground));
    text-decoration: none;
  }
  .locale-switcher a[data-active='true'] {
    color: hsl(var(--foreground));
    font-weight: 600;
  }
  .locale-switcher a:hover:not([data-active='true']) {
    color: hsl(var(--foreground));
  }
  .locale-switcher a:focus-visible {
    outline: 2px solid hsl(var(--foreground));
    outline-offset: 2px;
  }
</style>
