<script lang="ts" module>
  export { toast } from 'svelte-sonner';
</script>

<script lang="ts">
  import { Toaster } from 'svelte-sonner';
</script>

<Toaster
  position="top-center"
  richColors={false}
  closeButton
  toastOptions={{
    classes: {
      toast: 'group rounded-lg border border-border bg-surface text-foreground shadow-soft',
      title: 'font-semibold text-sm',
      description: 'text-xs text-ink-soft',
      success: 'bg-success text-success-foreground border-transparent',
      info: 'bg-info text-info-foreground border-transparent',
      warning: 'bg-warning text-warning-foreground border-transparent',
      error: 'bg-severe text-severe-foreground border-transparent'
    }
  }}
/>
