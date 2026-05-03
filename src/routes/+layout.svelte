<script lang="ts">
  import '../app.css';
  import { Toaster } from 'svelte-sonner';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex min-h-dvh flex-col">
  {@render children()}
</div>
<Toaster richColors position="top-center" />
