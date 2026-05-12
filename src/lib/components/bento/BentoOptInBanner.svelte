<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { X } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let { childId }: { childId: string } = $props();
  let dismissed = $state(false);

  onMount(() => {
    if (typeof document !== 'undefined' && document.cookie.includes('bento-opt-in-dismissed=1')) {
      dismissed = true;
    }
  });

  function dismiss() {
    dismissed = true;
    document.cookie = 'bento-opt-in-dismissed=1; path=/; max-age=' + 60 * 60 * 24 * 365 + '; samesite=lax';
  }
</script>

{#if !dismissed}
  <aside class="mb-4 flex items-start gap-3 rounded-tile bg-tile-butter px-4 py-3 shadow-soft">
    <div class="flex-1">
      <p class="text-sm font-bold leading-tight">{m.optInBannerTitle()}</p>
      <p class="text-xs text-ink-soft">{m.optInBannerSubtitle()}</p>
      <form method="POST" action={`/child/${childId}?/optInBento`} class="mt-2">
        <button
          type="submit"
          class="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition-transform duration-fast ease-soft active:scale-[0.97]"
        >
          {m.optInBannerCta()}
        </button>
      </form>
    </div>
    <button
      type="button"
      onclick={dismiss}
      aria-label={m.optInBannerDismissAria()}
      class="rounded-full p-1 text-ink-soft transition-colors hover:text-foreground"
    >
      <X size={16} aria-hidden="true" />
    </button>
  </aside>
{/if}
