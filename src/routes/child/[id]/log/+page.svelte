<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import FoodCombobox from '$lib/components/FoodCombobox.svelte';
  import ReactionPicker from '$lib/components/ReactionPicker.svelte';
  import { formatDateInputValue } from '$lib/utils/dates';
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let {
    data,
    form
  }: { data: PageData; form: ActionData } = $props();

  let givenAt = $state(formatDateInputValue());
  let reaction = $state<'ras' | 'inconfort' | 'reaction'>('ras');
  let submitting = $state(false);

  const initialFoodId = (() => {
    const v = Number($page.url.searchParams.get('foodId'));
    return Number.isInteger(v) && v > 0 ? v : null;
  })();
</script>

<div class="container max-w-xl space-y-5 py-6">
  <header>
    <a href={`/child/${data.child.id}`} class="text-sm text-muted-foreground hover:underline">
      ← Retour
    </a>
    <h1 class="mt-2 text-xl font-semibold">Logguer un aliment</h1>
    <p class="text-sm text-muted-foreground">Pour {data.child.name}</p>
  </header>

  <form
    method="POST"
    class="grid gap-5"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    {#if form?.error}
      <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {form.error}
      </div>
    {/if}

    <FoodCombobox foods={data.foods} {initialFoodId} />

    <div class="grid gap-1.5">
      <Label for="givenAt">Date et heure</Label>
      <Input id="givenAt" name="givenAt" type="datetime-local" bind:value={givenAt} required />
    </div>

    <div class="grid gap-1.5">
      <Label>Réaction</Label>
      <ReactionPicker name="reaction" bind:value={reaction} />
    </div>

    <div class="grid gap-1.5">
      <Label for="notes">Notes (optionnel)</Label>
      <Textarea id="notes" name="notes" maxlength={2000} placeholder="Quantité, contexte, observations…" />
    </div>

    <div class="flex gap-2">
      <Button type="submit" size="lg" class="flex-1" loading={submitting}>
        {submitting ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
      <Button href={`/child/${data.child.id}`} variant="outline" size="lg">Annuler</Button>
    </div>
  </form>
</div>
