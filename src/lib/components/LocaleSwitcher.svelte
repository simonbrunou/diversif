<script lang="ts">
  import { page } from '$app/state';
  import { languageTag, availableLanguageTags } from '$lib/paraglide/runtime';
  import { i18n } from '$lib/i18n';
  import * as m from '$lib/paraglide/messages';

  const labels: Record<string, string> = { fr: 'FR', en: 'EN' };
</script>

<nav class="locale-switcher" aria-label={m.chromeLocaleSwitcherLabel()}>
  {#each availableLanguageTags as locale}
    <a
      href={i18n.resolveRoute(page.url.pathname, locale) + page.url.search + page.url.hash}
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
