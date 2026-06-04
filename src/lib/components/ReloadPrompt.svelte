<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';

  // Prompt-based service-worker update flow (paired with registerType:'prompt'
  // in vite.config.ts). When a new SW is deployed it stays in the 'waiting'
  // state rather than claiming the page mid-session; we show a persistent toast
  // and only reload when the user taps it. onNeedRefresh fires client-side
  // only, so nothing happens during SSR (the virtual module is a no-op there).
  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      toast(m.pwaUpdateAvailable(), {
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: m.pwaUpdateReload(),
          onClick: () => {
            void updateServiceWorker(true);
          }
        }
      });
    }
  });
</script>
