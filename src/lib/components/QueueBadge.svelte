<script lang="ts">
  import { pendingCount } from '$lib/offline/queue';
</script>

{#if $pendingCount > 0}
  <span class="queue-badge" role="status">
    {$pendingCount} à synchroniser
  </span>
{/if}

<style>
  .queue-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    font-size: 0.75rem;
  }
</style>
