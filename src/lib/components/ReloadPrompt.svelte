<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';

  let swRegistration = $state<ServiceWorkerRegistration | undefined>();
  // Set once the user dismisses the update toast, so it stops reappearing
  // for the rest of the session — re-nagging every 30s indefinitely had no
  // opt-out.
  let dismissedForSession = false;

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
        dismissedForSession = true;
      }
    });
  }

  $effect(() => {
    if ($needRefresh && !dismissedForSession) showUpdateToast();
  });
</script>
