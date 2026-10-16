<script lang="ts">
  import Button from '#lib/components/ui/Button.svelte';
  import * as m from '#lib/paraglide/messages.js';

  // Mounted by boot-recovery.ts over the server-rendered page when the app
  // could not start: only plain links and forms work there, so this is the
  // one way back.
  let { onretry }: { onretry: () => void } = $props();
</script>

<div
  role="alert"
  data-boot-failure
  class="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-tile bg-surface p-4 text-foreground shadow-lifted"
>
  <!-- 10rem basis: below that the button wraps under the text instead of squeezing it. -->
  <p class="min-w-0 flex-[1_1_10rem] text-sm">{m.errorsNetwork()}</p>
  <Button onclick={onretry}>{m.offlineFallbackRetry()}</Button>
</div>
