<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Poll for SW updates every 60 s so the user gets fresh code
      // even if they keep the tab open for hours.
      setInterval(
        () => void registration.update(),
        60_000
      );
    }
  });

  $effect(() => {
    if ($needRefresh) {
      toast(m.pwaUpdateAvailable(), {
        action: {
          label: m.pwaUpdateAction(),
          onClick: () => void updateServiceWorker()
        },
        duration: Infinity
      });
    }
  });
</script>
