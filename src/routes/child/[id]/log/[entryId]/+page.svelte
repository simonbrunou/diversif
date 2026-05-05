<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import FoodCombobox from '$lib/components/FoodCombobox.svelte';
  import ReactionPicker from '$lib/components/ReactionPicker.svelte';
  import { formatDateInputValue } from '$lib/utils/dates';
  import { enhance } from '$app/forms';
  import { Trash2 } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';

  let {
    data,
    form
  }: { data: PageData; form: ActionData } = $props();

  // svelte-ignore state_referenced_locally
  let givenAt = $state(formatDateInputValue(new Date(data.entry.givenAt)));
  // svelte-ignore state_referenced_locally
  let reaction = $state<'ras' | 'inconfort' | 'reaction'>(data.entry.reaction);
  // svelte-ignore state_referenced_locally
  let notes = $state(data.entry.notes ?? '');
  let saving = $state(false);
  let deleting = $state(false);

  const backHref = $derived(
    data.from === 'dashboard' ? `/child/${data.child.id}` : `/child/${data.child.id}/foods`
  );
</script>

<div class="container max-w-xl space-y-5 py-6">
  <header>
    <a href={backHref} class="text-sm text-muted-foreground hover:underline">← Retour</a>
    <h1 class="mt-2 text-xl font-semibold">Modifier ce repas</h1>
    <p class="text-sm text-muted-foreground">Pour {data.child.name}</p>
  </header>

  <form
    method="POST"
    action="?/update"
    class="grid gap-5"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
      };
    }}
  >
    {#if form?.error}
      <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {form.error}
      </div>
    {/if}

    <input type="hidden" name="from" value={data.from} />

    <FoodCombobox foods={data.foods} initialFoodId={data.entry.foodId} />

    <div class="grid gap-1.5">
      <Label for="givenAt">Quand ?</Label>
      <Input id="givenAt" name="givenAt" type="datetime-local" bind:value={givenAt} required />
    </div>

    <div class="grid gap-1.5">
      <Label>Comment bébé a réagi ?</Label>
      <ReactionPicker name="reaction" bind:value={reaction} />
    </div>

    <div class="grid gap-1.5">
      <Label for="notes">Une note ? (facultatif)</Label>
      <Textarea
        id="notes"
        name="notes"
        maxlength={2000}
        placeholder="Quantité, ambiance du repas, observations…"
        bind:value={notes}
      />
    </div>

    <div class="flex gap-2">
      <Button type="submit" size="lg" class="flex-1" loading={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
      <Button href={backHref} variant="outline" size="lg">Annuler</Button>
    </div>
  </form>

  <form
    method="POST"
    action="?/delete"
    class="border-t pt-5"
    use:enhance={({ cancel }) => {
      if (!confirm('Supprimer ce repas ? L’opération est définitive.')) {
        cancel();
        return;
      }
      deleting = true;
      return async ({ update }) => {
        await update();
        deleting = false;
      };
    }}
  >
    <input type="hidden" name="from" value={data.from} />
    <Button type="submit" variant="ghost" size="sm" class="text-destructive hover:text-destructive" loading={deleting}>
      <Trash2 size={16} aria-hidden="true" />
      {deleting ? 'Suppression…' : 'Supprimer ce repas'}
    </Button>
  </form>
</div>
