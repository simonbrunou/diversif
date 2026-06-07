<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';

  let swRegistration = $state<ServiceWorkerRegistration | undefined>();

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

  function showUpdateToast() {
    toast(m.pwaUpdateAvailable(), {
      id: 'pwa-update',
      action: {
        label: m.pwaUpdateAction(),
        onClick: () => void updateServiceWorker()
      },
      duration: Infinity,
      onDismiss: () => {
        // Re-show after 30 s so the user doesn't lose the update prompt
        // if they swipe the toast away by accident.
        setTimeout(showUpdateToast, 30_000);
      }
    });
  }

  $effect(() => {
    if ($needRefresh) showUpdateToast();
  });
</script>
