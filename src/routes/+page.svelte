<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import { formatAge } from '$lib/utils/age';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="container max-w-2xl py-10">
  <h1 class="text-2xl font-semibold">Choisir un enfant</h1>
  <p class="mt-2 text-sm text-muted-foreground">Sélectionnez l’enfant à suivre.</p>

  <div class="mt-6 grid gap-3">
    {#each data.children as child (child.id)}
      <a href={`/child/${child.id}`} class="block">
        <Card class="p-4 transition-colors hover:bg-accent">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">{child.name}</div>
              <div class="text-sm text-muted-foreground">{formatAge(child.birthDate)}</div>
            </div>
            <span class="text-xs text-muted-foreground">
              {child.role === 'owner' ? 'Créateur' : 'Membre'}
            </span>
          </div>
        </Card>
      </a>
    {/each}
  </div>

  <div class="mt-6">
    <Button href="/child/new" variant="outline">+ Ajouter un enfant</Button>
  </div>
</div>
