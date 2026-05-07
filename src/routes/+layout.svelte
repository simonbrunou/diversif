<script lang="ts">
  import '../app.css';
  import { Toaster, toast } from 'svelte-sonner';
  import { flush } from '$lib/offline/queue';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { setLanguageTag } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  import { applyTheme, getStoredTheme } from '$lib/utils/theme';
  import PublicHeader from '$lib/components/PublicHeader.svelte';
  import PublicFooter from '$lib/components/PublicFooter.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { organizationJsonLd, websiteJsonLd, SITE } from '$lib/seo';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const siteUrl = $derived(data.siteUrl ?? SITE.defaultOrigin);

  // Strip the /en locale prefix once before route classification — the visible
  // URL keeps the prefix, but reroute makes the underlying SvelteKit route the
  // same as the FR variant, so shell predicates have to match the unprefixed
  // form to keep `/en/login` etc. on the auth layout instead of the public shell.
  const unprefixedPath = $derived(
    $page.url.pathname.replace(/^\/en(?=\/|$)/, '') || '/'
  );

  const isChildRoute = $derived(unprefixedPath.startsWith('/child/'));

  const isPublicShell = $derived(
    !unprefixedPath.startsWith('/child/') &&
      !unprefixedPath.startsWith('/account') &&
      !unprefixedPath.startsWith('/login') &&
      !unprefixedPath.startsWith('/signup') &&
      !unprefixedPath.startsWith('/join') &&
      !(unprefixedPath === '/' && data.user)
  );

  const firstChildId = $derived(data.children[0]?.id ?? null);

  // Keep paraglide's runtime locale and the <html lang> attribute in sync with
  // the URL on the client. SvelteKit's reroute strips the /en/ prefix from
  // event.url before the server hook runs, so we resolve from the original
  // pathname here ($page.url is the visible URL, which still has the prefix).
  // SSR sets these correctly via hooks.server.ts; this $effect handles all
  // client-side navigations after hydration.
  const locale = $derived(unprefixedPath !== $page.url.pathname ? 'en' : 'fr');

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

  onMount(() => {
    const handleOnline = () => {
      void flush();
    };
    const handleSynced = () => {
      toast.success(m.offlineSyncedToast());
    };
    const handleDropped = () => {
      toast.error(m.offlineDroppedToast());
    };
    const handleSessionExpired = () => {
      toast.error(m.offlineSessionExpiredToast());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('queue:synced', handleSynced);
    window.addEventListener('queue:dropped', handleDropped);
    window.addEventListener('queue:sessionExpired', handleSessionExpired);

    if (navigator.onLine) void flush();
    const interval = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 60_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('queue:synced', handleSynced);
      window.removeEventListener('queue:dropped', handleDropped);
      window.removeEventListener('queue:sessionExpired', handleSessionExpired);
      window.clearInterval(interval);
    };
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
