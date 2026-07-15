<script lang="ts">
  import '../app.css';
  import { Toaster, toast } from 'svelte-sonner';
  import { flush, count as pendingQueueCount } from '$lib/offline/queue';
  import { purgeClientState } from '$lib/offline/purge';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import { onNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { deLocalizeHref } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  import { applyTheme, getStoredTheme } from '$lib/utils/theme';
  import PublicHeader from '$lib/components/PublicHeader.svelte';
  import PublicFooter from '$lib/components/PublicFooter.svelte';
  import AppShellBento from '$lib/components/AppShellBento.svelte';
  import ReloadPrompt from '$lib/components/ReloadPrompt.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { organizationJsonLd, websiteJsonLd, SITE } from '$lib/seo';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const siteUrl = SITE.defaultOrigin;

  // Strip the /en locale prefix once before route classification : the visible
  // URL keeps the prefix, but reroute makes the underlying SvelteKit route the
  // same as the FR variant, so shell predicates have to match the unprefixed
  // form to keep `/en/login` etc. on the auth layout instead of the public shell.
  const unprefixedPath = $derived(deLocalizeHref(page.url.pathname) || '/');

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

  const isAccountRoute = $derived(unprefixedPath.startsWith('/account'));

  const bentoKids = $derived(
    data.children.map((c) => ({
      id: String(c.id),
      name: c.name,
      birthMonth: c.birthDate,
      avatarSeed: '🌱'
    }))
  );

  // Keep the <html lang> attribute in sync with the URL on the client. The
  // paraglide 2.x runtime itself needs no syncing — its `url` strategy
  // re-reads window.location on every getLocale() call — but the <html lang>
  // attribute was rendered by SSR (hooks.server.ts) and only this $effect
  // updates it across client-side navigations after hydration.
  const locale = $derived(unprefixedPath !== page.url.pathname ? 'en' : 'fr');

  $effect(() => {
    if (!browser) return;
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  });

  // Purge the service-worker 'pages' cache + the offline IndexedDB queue when
  // the session ENDS — i.e. on the authenticated→anonymous transition only.
  // BACKSTOP for client-side-detected expiry only (e.g. an invalidate/goto
  // that re-runs the root layout load with user=null mid-session). It does
  // NOT cover the logout buttons: those are full-document POSTs, the layout
  // remounts fresh on /login and this effect never observes the transition.
  // Explicit logout is handled by purgeBeforeSubmit on the forms
  // (account/sessions/+page.svelte) plus the server's Clear-Site-Data header.
  // A plain (non-reactive) latch — not $state — so the effect re-runs only
  // when `data.user` changes. It starts undefined and is seeded by the
  // effect's first run (right after hydration), so a visitor who lands
  // logged-out never triggers a purge. $effect never runs during SSR, so this
  // is browser-only by construction. purgeClientState() is fire-and-forget
  // and swallows its own failures (see its doc comment).
  let wasAuthenticated: boolean | undefined;
  $effect(() => {
    const authenticated = Boolean(data.user);
    if (wasAuthenticated === true && !authenticated) {
      void purgeClientState();
    }
    wasAuthenticated = authenticated;
  });

  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  onMount(() => {
    // Deterministic hydration signal: SSR'd inputs can lose values typed
    // before the client render claims them, which made e2e form fills (and
    // real users on slow connections) race hydration. Tests gate their
    // first interaction on this attribute instead of retry loops; it costs
    // nothing in production and survives client-side navigations (the root
    // layout never unmounts).
    document.documentElement.dataset.hydrated = 'true';

    // Sync the theme cookie with the localStorage choice once per load:
    // users who picked dark/light before the cookie existed would otherwise
    // keep a stale SSR theme and Profil meta until they re-toggled.
    applyTheme(getStoredTheme());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  });

  // Persistent "N entries pending sync" toast, upserted in place (same id, so
  // it never stacks) instead of the app only ever showing one-shot toasts for
  // queue/dequeue events. Without this, a caregiver who logs a meal offline,
  // misses the one-shot "saved offline" toast, or reopens the app later has
  // no way to see anything is still waiting to sync.
  const PENDING_TOAST_ID = 'offline-pending';
  function refreshPendingIndicator(): void {
    void pendingQueueCount()
      .then((n) => {
        if (n <= 0) {
          toast.dismiss(PENDING_TOAST_ID);
          return;
        }
        toast(n === 1 ? m.offlineQueuePendingOne() : m.offlineQueuePendingOther({ count: n }), {
          id: PENDING_TOAST_ID,
          duration: Infinity
        });
      })
      .catch(() => {
        // Best-effort indicator only — IndexedDB being briefly unavailable
        // must never surface as an error toast of its own.
      });
  }

  onMount(() => {
    const handleOnline = () => {
      void flush();
    };
    const handleSynced = () => {
      toast.success(m.offlineSyncedToast());
    };
    const handleDropped = () => {
      // Longer duration than the default: a dropped, un-recoverable entry is
      // more consequential than a routine success toast and deserves more
      // time to actually be read before it fades.
      toast.error(m.offlineDroppedToast(), { duration: 6000 });
    };
    const handleSessionExpired = () => {
      toast.error(m.offlineSessionExpiredToast(), { duration: 6000 });
    };
    // Fired by queue.ts on every enqueue/delete/clear — keeps the pending
    // count current in real time (not just after the next flush poll).
    const handleQueueChanged = () => refreshPendingIndicator();

    window.addEventListener('online', handleOnline);
    window.addEventListener('queue:synced', handleSynced);
    window.addEventListener('queue:dropped', handleDropped);
    window.addEventListener('queue:sessionExpired', handleSessionExpired);
    window.addEventListener('queue:changed', handleQueueChanged);

    refreshPendingIndicator();
    if (navigator.onLine) void flush();
    const interval = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 60_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('queue:synced', handleSynced);
      window.removeEventListener('queue:dropped', handleDropped);
      window.removeEventListener('queue:sessionExpired', handleSessionExpired);
      window.removeEventListener('queue:changed', handleQueueChanged);
      window.clearInterval(interval);
    };
  });
</script>

<svelte:head>
  <meta name="application-name" content={SITE.name} />
  <meta name="apple-mobile-web-app-title" content={SITE.name} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta name="generator" content="SvelteKit" />
  <link rel="privacy-policy" href="/politique-confidentialite" />
  <link rel="terms-of-service" href="/cgu" />
</svelte:head>

<JsonLd data={organizationJsonLd(siteUrl)} />
<JsonLd data={websiteJsonLd(siteUrl)} />

<a href="#main" class="skip-link">{m.chromeSkipToContent()}</a>

<div class="safe-top flex min-h-dvh flex-col">
  {#if isChildRoute || isAccountRoute}
    <AppShellBento
      user={data.user ? { email: data.user.email } : undefined}
      kids={bentoKids}
      currentChildId={data.currentChildId ?? undefined}
      currentPath={unprefixedPath}
    >
      {@render children()}
    </AppShellBento>
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
{#if browser}
  <ReloadPrompt />
{/if}
<Toaster richColors position="top-center" />
