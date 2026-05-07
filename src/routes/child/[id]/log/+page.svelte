<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import FoodCombobox from '$lib/components/FoodCombobox.svelte';
  import ReactionPicker from '$lib/components/ReactionPicker.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import { formatDateInputValue } from '$lib/utils/dates';
  import { ageInMonths } from '$lib/utils/age';
  import { getTipsFor, pickRotatingTip } from '$lib/content/guidance';
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import { localizedHref } from '$lib/utils/localized-href';
  import { Info } from 'lucide-svelte';
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

  // Surface a stage-relevant tip below the form
  const months = $derived(ageInMonths(data.child.birthDate));
  const tip = $derived(pickRotatingTip(getTipsFor({ ageMonths: months }), data.child.id + 7));
</script>

<div class="container max-w-xl space-y-5 py-6">
  <header>
    <a href={localizedHref(`/child/${data.child.id}`)} class="text-sm text-muted-foreground hover:underline">
      ← Retour
    </a>
    <h1 class="mt-2 text-xl font-semibold">Noter un repas</h1>
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
      <Label for="givenAt">Quand ?</Label>
      <Input id="givenAt" name="givenAt" type="datetime-local" bind:value={givenAt} required />
    </div>

    <div class="grid gap-1.5">
      <Label>Comment bébé a réagi ?</Label>
      <ReactionPicker name="reaction" bind:value={reaction} />
      <details class="mt-1 rounded-md border bg-muted/40 p-2 text-xs">
        <summary class="flex cursor-pointer items-center gap-1.5 font-medium text-foreground/80">
          <Info size={12} aria-hidden="true" />
          Comment choisir ?
        </summary>
        <ul class="mt-2 space-y-1.5 pl-4 text-muted-foreground">
          <li>
            <strong class="text-reaction-ras">Tout va bien</strong> — bébé a bien toléré, aucun
            signe particulier.
          </li>
          <li>
            <strong class="text-reaction-inconfort">Petit inconfort</strong> — gêne digestive ou
            cutanée légère (régurgitation, selles molles, rougeurs autour de la bouche). Reproposez
            à distance et observez.
          </li>
          <li>
            <strong class="text-reaction-reaction">Réaction marquée</strong> — urticaire, œdème,
            vomissements, gêne respiratoire. <strong>Arrêtez tout de suite</strong> et consultez.
            En cas de gêne respiratoire ou d'œdème de la gorge, appelez le 15.
          </li>
        </ul>
      </details>
    </div>

    <div class="grid gap-1.5">
      <Label for="notes">Une note ? (facultatif)</Label>
      <Textarea
        id="notes"
        name="notes"
        maxlength={2000}
        placeholder="Quantité, ambiance du repas, observations…"
      />
    </div>

    <div class="flex gap-2">
      <Button type="submit" size="lg" class="flex-1" loading={submitting}>
        {submitting ? 'Enregistrement…' : 'Noter ce repas'}
      </Button>
      <Button href={localizedHref(`/child/${data.child.id}`)} variant="outline" size="lg">Annuler</Button>
    </div>
  </form>

  {#if tip}
    <TipCard
      tone="info"
      eyebrow="Astuce"
      body={tip.body}
      sources={tip.sources ? [...tip.sources] : undefined}
    />
  {/if}
</div>
