<script lang="ts">
  import '../app.css';
  import { Toaster } from 'svelte-sonner';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/stores';
  import { applyTheme, getStoredTheme } from '$lib/utils/theme';

  let { children }: { children: Snippet } = $props();

  const isChildRoute = $derived($page.url.pathname.startsWith('/child/'));

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
  {#if !isChildRoute}
    <main id="main" class="flex flex-1 flex-col">
      {@render children()}
    </main>
  {:else}
    {@render children()}
  {/if}
</div>
<Toaster richColors position="top-center" />
