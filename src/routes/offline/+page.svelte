<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  function retry() {
    location.reload();
  }
</script>

<main class="offline-page">
  <h1>{m.offlineFallbackTitle()}</h1>
  <p>{m.offlineFallbackBody()}</p>
  <button type="button" onclick={retry}>{m.offlineFallbackRetry()}</button>
</main>

<style>
  .offline-page {
    max-width: 32rem;
    margin: 4rem auto;
    padding: 0 1rem;
    text-align: center;
  }
  .offline-page button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
</style>
