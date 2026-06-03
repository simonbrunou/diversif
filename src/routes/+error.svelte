<script lang="ts">
  import { page } from '$app/state';
  import Button from '$components/ui/Button.svelte';
  import { AlertTriangle } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';

  const status = $derived(page.status);
  const message = $derived(page.error?.message ?? 'Une erreur est survenue.');
  const title = $derived(status === 404 ? m.errorsGenericTitle404() : m.errorsGenericTitleDefault());
</script>

<div class="container flex max-w-md flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
  <div class="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
    <AlertTriangle size={28} aria-hidden="true" />
  </div>
  <div>
    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.errorsGenericLabel({ status })}</p>
    <h1 class="mt-1 text-2xl font-semibold">{title}</h1>
    <p class="mt-2 text-sm text-muted-foreground">{message}</p>
    {#if page.error?.errorId}
      <p class="mt-2 text-xs text-muted-foreground/80">
        {m.errorsGenericRef()} <code class="font-mono">{page.error.errorId}</code>
      </p>
    {/if}
  </div>
  <div class="flex flex-wrap justify-center gap-2">
    <Button href={localizedHref('/')}>{m.errorsGenericHome()}</Button>
    <Button variant="outline" onclick={() => history.back()}>{m.errorsGenericBack()}</Button>
  </div>
</div>
