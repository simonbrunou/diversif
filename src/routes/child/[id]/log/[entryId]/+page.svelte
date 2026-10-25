<script lang="ts">
  import Button from '#lib/components/ui/Button.svelte';
  import Input from '#lib/components/ui/Input.svelte';
  import Label from '#lib/components/ui/Label.svelte';
  import Textarea from '#lib/components/ui/Textarea.svelte';
  import FormError from '#lib/components/ui/FormError.svelte';
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import Card from '#lib/components/ui/Card.svelte';
  import ConfirmModal from '#lib/components/ui/ConfirmModal.svelte';
  import FoodCombobox from '#lib/components/FoodCombobox.svelte';
  import ReactionPicker from '#lib/components/ReactionPicker.svelte';
  import TexturePicker from '#lib/components/TexturePicker.svelte';
  import RepasForm from '#lib/components/RepasForm.svelte';
  import { formatDateInputValue } from '#lib/utils/dates.js';
  import { localizedHref } from '#lib/utils/localized-href.js';
  import type { TextureKey } from '#lib/utils/textures.js';
  import { moreSevere, type ReactionId, type ReactionsByEntry } from '#lib/utils/reaction-values.js';
  import type { ActionResult } from '$app/forms';
  import { Trash, X } from '@lucide/svelte';
  import * as m from '#lib/paraglide/messages.js';
  import type { ActionData, PageData } from './$types';

  let {
    data,
    form
  }: { data: PageData; form: ActionData } = $props();

  // svelte-ignore state_referenced_locally
  let givenAt = $state(formatDateInputValue(new Date(data.entry.givenAt)));
  // svelte-ignore state_referenced_locally
  let reaction = $state<ReactionId>(data.entry.reaction);
  // The stored value the form loaded, for the server's dirty-only reaction
  // guard, same role as mealReactionsLoaded below: it must never follow the
  // picker. Only a reaction refusal moves it (reseedReactions).
  // svelte-ignore state_referenced_locally
  let reactionLoaded = $state<ReactionId>(data.entry.reaction);
  // svelte-ignore state_referenced_locally
  let texture = $state<TextureKey | null>(data.entry.texture);
  let texturePristine = $state(false);
  // svelte-ignore state_referenced_locally
  let notes = $state(data.entry.notes ?? '');
  let saving = $state(false);
  let deleteOpen = $state(false);

  // Meal mode: a mutable per-member copy of each ingredient's reaction, seeded
  // once from the loaded meal (mirrors the single-entry `reaction` above). A
  // reaction refusal reseeds it (reseedReactions).
  // svelte-ignore state_referenced_locally
  let mealMembers = $state((data.meal?.members ?? []).map((mem) => ({ ...mem })));

  // Each member's stored reaction as the form loaded it, kept apart from the
  // pickers above. The `update` action only writes a member's reaction when
  // the submitted `reaction.{id}` differs from `reactionLoaded.{id}`. If this
  // snapshot tracked the same mutable value as the picker instead, submitted
  // would always equal loaded and that guard would never fire: reaction edits
  // would silently no-op. Only a reaction refusal moves it (reseedReactions).
  // svelte-ignore state_referenced_locally
  let mealReactionsLoaded = $state<ReactionsByEntry>(
    Object.fromEntries((data.meal?.members ?? []).map((mem) => [mem.id, mem.reaction]))
  );

  // A reaction refusal (#445): a symptom or a co-parent changed a reaction
  // since the form loaded, and the parent's pick for it was less severe. The
  // refusal hands back every stored reaction; each one that changed is now
  // posted as loaded, so the next save goes through. Without JavaScript the
  // page reloads instead, and `load` seeds every picker from the stored values.
  function reseedReactions(result: ActionResult) {
    if (result.type !== 'failure') return;
    const stored = result.data?.reactions as ReactionsByEntry | undefined;
    if (!stored) return;
    if (!data.meal) {
      [reaction, reactionLoaded] = reseed(reaction, reactionLoaded, stored[data.entry.id]);
      return;
    }
    for (const member of mealMembers) {
      [member.reaction, mealReactionsLoaded[member.id]] = reseed(
        member.reaction,
        mealReactionsLoaded[member.id],
        stored[member.id]
      );
    }
  }

  // One reaction's [pick, loaded] after a refusal. An untouched picker follows
  // the stored value, even a lower one a co-parent saved. A pick the parent
  // made keeps the more severe of it and the stored value, as the server would.
  function reseed(
    pick: ReactionId,
    loaded: ReactionId,
    stored: ReactionId | undefined
  ): [ReactionId, ReactionId] {
    if (!stored || stored === loaded) return [pick, loaded];
    return [pick === loaded ? stored : moreSevere(pick, stored), stored];
  }

  let mealSaving = $state(false);
  let mealDeleteOpen = $state(false);

  // Per-ingredient "Retirer" is a destructive DELETE, so it goes through a
  // confirm dialog (like "Supprimer le repas") rather than an in-form submit
  // button. Critically, it must NOT be a `type="submit"` inside the update
  // form: a per-row submit button renders BEFORE "Enregistrer", so it would be
  // the form's implicit default submit — pressing Enter in the date field
  // would fire the FIRST submit button in tree order and silently DELETE the
  // first ingredient (native implicit submission; enhance doesn't change
  // event.submitter). `pendingRemoveId` records which row the caregiver chose;
  // the actual POST goes through the dedicated ConfirmModal form below.
  let pendingRemoveId = $state<number | null>(null);
  let removeOpen = $state(false);
  const pendingRemoveFood = $derived(
    mealMembers.find((mem) => mem.id === pendingRemoveId)?.foodName ?? ''
  );

  const backHref = $derived(
    data.from === 'dashboard' ? `/child/${data.child.id}` : `/child/${data.child.id}/foods`
  );

  // Without JavaScript the browser posts to this URL, and SvelteKit renders a
  // refused save there: `from` must be in it for `load` to keep the editor's
  // origin, or the next save lands on the carnet (#443).
  const updateAction = $derived(`?/update&from=${data.from}`);
</script>

{#if data.meal}
  <div class="mx-auto w-full px-4 max-w-xl space-y-5 py-6">
    <BackHeader
      title={m.mealEditTitle()}
      subtitle={m.logFormSubtitle({ name: data.child.name })}
      fallback={backHref}
    />

    <RepasForm
      action={updateAction}
      class="grid gap-5"
      bind:busy={mealSaving}
      onapplied={reseedReactions}
    >
      <FormError messageKey={form?.errorKey} {form} />

      <input type="hidden" name="from" value={data.from} />

      <div class="grid gap-1.5">
        <Label for="mealGivenAt">{m.logFormGivenAtLabel()}</Label>
        <Input
          id="mealGivenAt"
          name="givenAt"
          type="datetime-local"
          bind:value={givenAt}
          min={`${data.child.birthDate}T00:00`}
          required
        />
      </div>

      <div class="grid gap-1.5">
        <Label>{m.textureLabel()}</Label>
        <TexturePicker name="texture" bind:value={texture} bind:pristine={texturePristine} />
        {#if texture === null}
          <input type="hidden" name="texture" value="" />
        {/if}
      </div>

      <div class="grid gap-1.5">
        <Label for="mealNotes">{m.logFormNoteLabel()}</Label>
        <Textarea
          id="mealNotes"
          name="notes"
          maxlength={2000}
          placeholder={m.logFormNotePlaceholder()}
          bind:value={notes}
        />
      </div>

      <div class="grid gap-3">
        {#each mealMembers as member (member.id)}
          <Card padding="md" class="grid gap-2">
            <div class="flex items-center justify-between gap-2">
              <a
                href={localizedHref(`/child/${data.child.id}/foods/${member.id}`)}
                class="font-medium hover:underline"
              >
                {member.foodName}
              </a>
              <!-- type="button", NOT a submit: a per-row submit button here
                   renders before "Enregistrer", so Enter in the date field
                   would fire it (implicit default submit = first submit button
                   in tree order) and silently DELETE this ingredient. Opening a
                   confirm dialog instead both removes that hazard and matches
                   the confirm affordance the other destructive actions
                   (?/delete, ?/deleteMeal) already use. -->
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => {
                  pendingRemoveId = member.id;
                  removeOpen = true;
                }}
              >
                <X size={14} aria-hidden="true" />
                {m.mealEditRemoveIngredient()}
              </Button>
            </div>

            <Label>{m.mealEditIngredientReactionLabel({ food: member.foodName })}</Label>
            <ReactionPicker name={`reaction.${member.id}`} bind:value={member.reaction} />
            <input
              type="hidden"
              name={`reactionLoaded.${member.id}`}
              value={mealReactionsLoaded[member.id]}
            />
          </Card>
        {/each}
      </div>

      <div class="flex gap-2">
        <Button type="submit" size="lg" class="flex-1" loading={mealSaving}>
          {mealSaving ? m.logFormSubmitting() : m.commonSave()}
        </Button>
        <Button href={backHref} variant="outline" size="lg">{m.commonCancel()}</Button>
      </div>
    </RepasForm>

    <div class="border-t pt-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="text-severe-text hover:text-severe-text"
        onclick={() => (mealDeleteOpen = true)}
      >
        <Trash size={16} aria-hidden="true" />
        {m.mealEditDelete()}
      </Button>
    </div>
  </div>

  <!-- Dedicated remove-ingredient form (like the deleteMeal ConfirmModal
       below), carrying the chosen row's removeId + the forwarded `from`. This
       lives OUTSIDE the update form, so its submit button can never become the
       update form's implicit default submit. -->
  <ConfirmModal
    bind:open={removeOpen}
    title={m.mealEditRemoveConfirmTitle({ food: pendingRemoveFood })}
    description={m.mealEditRemoveConfirmDescription()}
    action="?/removeIngredient"
    confirmLabel={m.mealEditRemoveIngredient()}
    loadingLabel={m.logEditDeleting()}
    destructive
    hiddenFields={{ removeId: pendingRemoveId ?? '', from: data.from }}
    failureMessage={m.errorsGenericFallback()}
  />

  <ConfirmModal
    bind:open={mealDeleteOpen}
    title={m.logEditDeleteConfirmTitle()}
    description={m.logEditDeleteConfirmDescription()}
    action="?/deleteMeal"
    confirmLabel={m.mealEditDelete()}
    loadingLabel={m.logEditDeleting()}
    destructive
    hiddenFields={{ from: data.from }}
    failureMessage={m.errorsGenericFallback()}
  />
{:else}
  <div class="mx-auto w-full px-4 max-w-xl space-y-5 py-6">
    <BackHeader
      title={m.logEditTitle()}
      subtitle={m.logFormSubtitle({ name: data.child.name })}
      fallback={backHref}
    />

    <RepasForm
      action={updateAction}
      class="grid gap-5"
      bind:busy={saving}
      onapplied={reseedReactions}
    >
      <FormError messageKey={form?.errorKey} {form} />

      <input type="hidden" name="from" value={data.from} />

      <FoodCombobox foods={data.foods} initialFoodId={data.entry.foodId} />

      <div class="grid gap-1.5">
        <Label for="givenAt">{m.logFormGivenAtLabel()}</Label>
        <Input
          id="givenAt"
          name="givenAt"
          type="datetime-local"
          bind:value={givenAt}
          min={`${data.child.birthDate}T00:00`}
          required
        />
      </div>

      <div class="grid gap-1.5">
        <Label>{m.logFormReactionLegend()}</Label>
        <ReactionPicker name="reaction" bind:value={reaction} />
        <input type="hidden" name="reactionLoaded" value={reactionLoaded} />
      </div>

      <div class="grid gap-1.5">
        <Label>{m.textureLabel()}</Label>
        <TexturePicker
          name="texture"
          bind:value={texture}
          bind:pristine={texturePristine}
        />
        {#if texture === null}
          <input type="hidden" name="texture" value="" />
        {/if}
      </div>

      <div class="grid gap-1.5">
        <Label for="notes">{m.logFormNoteLabel()}</Label>
        <Textarea
          id="notes"
          name="notes"
          maxlength={2000}
          placeholder={m.logFormNotePlaceholder()}
          bind:value={notes}
        />
      </div>

      <div class="flex gap-2">
        <Button type="submit" size="lg" class="flex-1" loading={saving}>
          {saving ? m.logFormSubmitting() : m.commonSave()}
        </Button>
        <Button href={backHref} variant="outline" size="lg">{m.commonCancel()}</Button>
      </div>
    </RepasForm>

    <div class="border-t pt-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="text-severe-text hover:text-severe-text"
        onclick={() => (deleteOpen = true)}
      >
        <Trash size={16} aria-hidden="true" />
        {m.logEditDeleteCta()}
      </Button>
    </div>
  </div>

  <ConfirmModal
    bind:open={deleteOpen}
    title={m.logEditDeleteConfirmTitle()}
    description={m.logEditDeleteConfirmDescription()}
    action="?/delete"
    confirmLabel={m.logEditDeleteCta()}
    loadingLabel={m.logEditDeleting()}
    destructive
    hiddenFields={{ from: data.from }}
    failureMessage={m.errorsGenericFallback()}
  />
{/if}
