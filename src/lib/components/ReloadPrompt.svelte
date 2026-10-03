<script lang="ts">
  import { onMount } from 'svelte';
  import { Workbox } from 'workbox-window';
  import { toast } from 'svelte-sonner';
  import { dev } from '$app/env';
  import * as m from '#lib/paraglide/messages.js';

  // Set once the user dismisses the update toast, so it stops reappearing
  // for the rest of the session — re-nagging every 30s indefinitely had no
  // opt-out.
  let dismissedForSession = false;

  // Reload once the new worker is active, so the page runs the code it
  // serves. This watches the waiting worker itself, not this page's
  // controller: the tab that installed the first worker isn't controlled by
  // it, and nothing is left waiting once another tab accepted the update.
  async function acceptUpdate() {
    const waiting = (await navigator.serviceWorker.getRegistration())?.waiting;
    if (!waiting) {
      // Another tab already accepted it: the new worker is live.
      window.location.reload();
      return;
    }
    waiting.addEventListener('statechange', () => {
      if (waiting.state === 'activated') window.location.reload();
    });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function showUpdateToast() {
    if (dismissedForSession) return;
    toast(m.pwaUpdateAvailable(), {
      id: 'pwa-update',
      action: {
        label: m.pwaUpdateAction(),
        onClick: () => void acceptUpdate()
      },
      duration: Infinity,
      onDismiss: () => {
        dismissedForSession = true;
      }
    });
  }

  // SvelteKit's own registration is off (vite.config.ts `serviceWorker`), so
  // the worker built from src/service-worker/ is registered here, in
  // production only, and a new version waits for the parent's go-ahead
  // instead of swapping code under an open form.
  onMount(() => {
    if (dev || !('serviceWorker' in navigator)) return;
    const wb = new Workbox('/service-worker.js', { type: 'module' });
    wb.addEventListener('waiting', showUpdateToast);

    // Poll for SW updates every 60 s so the user gets fresh code even if
    // they keep the tab open for hours.
    let pollId: ReturnType<typeof setInterval> | undefined;
    let unmounted = false;
    wb.register()
      .then((registration) => {
        if (!registration || unmounted) return;
        pollId = setInterval(() => void registration.update(), 60_000);
      })
      // The app works without a worker (blocked storage, a browser without
      // module workers, a failed first fetch): nothing to report.
      .catch(() => {});
    return () => {
      unmounted = true;
      clearInterval(pollId);
    };
  });
</script>
