<script lang="ts">
  import '../app.css';
  import { Toaster } from 'svelte-sonner';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/stores';
  import { applyTheme, getStoredTheme } from '$lib/utils/theme';
  import PublicHeader from '$lib/components/PublicHeader.svelte';
  import PublicFooter from '$lib/components/PublicFooter.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

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

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  });
</script>

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
