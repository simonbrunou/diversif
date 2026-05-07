<script lang="ts">
  import '../app.css';
  import { Toaster } from 'svelte-sonner';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { setLanguageTag } from '$lib/paraglide/runtime';
  import { applyTheme, getStoredTheme } from '$lib/utils/theme';
  import PublicHeader from '$lib/components/PublicHeader.svelte';
  import PublicFooter from '$lib/components/PublicFooter.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { organizationJsonLd, websiteJsonLd, SITE } from '$lib/seo';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const siteUrl = $derived(data.siteUrl ?? SITE.defaultOrigin);

  const isChildRoute = $derived($page.url.pathname.startsWith('/child/'));

  const isPublicShell = $derived(
    !$page.url.pathname.startsWith('/child/') &&
      !$page.url.pathname.startsWith('/account') &&
      !$page.url.pathname.startsWith('/login') &&
      !$page.url.pathname.startsWith('/signup') &&
      !$page.url.pathname.startsWith('/join') &&
      !($page.url.pathname === '/' && data.user)
  );

  const firstChildId = $derived(data.children[0]?.id ?? null);

  // Keep paraglide's runtime locale and the <html lang> attribute in sync with
  // the URL on the client. SvelteKit's reroute strips the /en/ prefix from
  // event.url before the server hook runs, so we resolve from the original
  // pathname here ($page.url is the visible URL, which still has the prefix).
  // SSR sets these correctly via hooks.server.ts; this $effect handles all
  // client-side navigations after hydration.
  const locale = $derived(/^\/en(?:\/|$)/.test($page.url.pathname) ? 'en' : 'fr');

  $effect(() => {
    if (!browser) return;
    setLanguageTag(locale);
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  });

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  });
</script>

<svelte:head>
  <meta name="application-name" content={SITE.name} />
  <meta name="apple-mobile-web-app-title" content={SITE.name} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta name="generator" content="SvelteKit" />
  <link rel="privacy-policy" href="/politique-confidentialite" />
  <link rel="terms-of-service" href="/cgu" />
</svelte:head>

<JsonLd data={organizationJsonLd(siteUrl)} />
<JsonLd data={websiteJsonLd(siteUrl)} />

<a href="#main" class="skip-link">Aller au contenu</a>

<div class="safe-top flex min-h-dvh flex-col">
  {#if isChildRoute}
    {@render children()}
  {:else if isPublicShell}
    <PublicHeader user={data.user} {firstChildId} />
    <main id="main" class="flex flex-1 flex-col">
      {@render children()}
    </main>
    <PublicFooter />
  {:else}
    <main id="main" class="flex flex-1 flex-col">
      {@render children()}
    </main>
  {/if}
</div>
<Toaster richColors position="top-center" />
