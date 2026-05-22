<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { WifiOff } from 'lucide-svelte';

  function retry() {
    location.reload();
  }
</script>

<div class="container mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
  <div
    class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card"
  >
    <WifiOff size={28} aria-hidden="true" />
  </div>
  <h1 class="text-xl font-semibold">{m.offlineFallbackTitle()}</h1>
  <p class="mt-2 max-w-sm text-sm text-ink-soft">{m.offlineFallbackBody()}</p>
  <Button onclick={retry} class="mt-6">{m.offlineFallbackRetry()}</Button>
</div>
