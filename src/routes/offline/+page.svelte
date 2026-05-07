<script lang="ts">
  function retry() {
    location.reload();
  }
</script>

<main class="offline-page">
  <h1>Hors-ligne</h1>
  <p>Vous êtes hors-ligne. Vos entrées en attente seront synchronisées dès le retour de la connexion.</p>
  <button type="button" onclick={retry}>Réessayer</button>
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
