<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="container flex max-w-md flex-1 flex-col justify-center py-10">
  <Card class="p-6 text-center">
    <h1 class="text-xl font-semibold">Invitation</h1>

    {#if data.error}
      <p class="mt-3 text-sm text-destructive">{data.error}</p>
      <div class="mt-6">
        <Button href={localizedHref('/')} variant="outline">Retour</Button>
      </div>
    {:else if data.child}
      <p class="mt-3 text-sm text-muted-foreground">
        Vous êtes invité·e à suivre <span class="font-medium text-foreground">{data.child.name}</span>.
      </p>
      <p class="mt-2 text-xs text-muted-foreground">Code <span class="font-mono">{data.code}</span></p>

      {#if form?.error}
        <div class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {form.error}
        </div>
      {/if}

      <form method="POST" class="mt-6 flex justify-center gap-2">
        <Button href={localizedHref('/')} variant="outline">Annuler</Button>
        <Button type="submit">Accepter l’invitation</Button>
      </form>
    {/if}
  </Card>
</div>
