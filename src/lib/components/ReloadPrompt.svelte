<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';

  let swRegistration: ServiceWorkerRegistration | undefined;

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      swRegistration = registration ?? undefined;
    }
  });

  // Poll for SW updates every 60 s so the user gets fresh code
  // even if they keep the tab open for hours.
  $effect(() => {
    if (!swRegistration) return;
    const id = setInterval(() => void swRegistration!.update(), 60_000);
    return () => clearInterval(id);
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
