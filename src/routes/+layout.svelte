<script lang="ts">
  import '../app.css';
  import { Toaster } from 'svelte-sonner';
  import { onMount, type Snippet } from 'svelte';
  import { applyTheme, getStoredTheme } from '$lib/utils/theme';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  });
</script>

<div class="safe-top flex min-h-dvh flex-col">
  {@render children()}
</div>
<Toaster richColors position="top-center" />
