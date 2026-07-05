<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import FormError from '$components/ui/FormError.svelte';
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Card from '$components/ui/Card.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import FoodCombobox from '$lib/components/FoodCombobox.svelte';
  import ReactionPicker from '$lib/components/ReactionPicker.svelte';
  import TexturePicker from '$lib/components/TexturePicker.svelte';
  import { formatDateInputValue, localInputToIso } from '$lib/utils/dates';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { TextureKey } from '$lib/utils/textures';
  import { enhance } from '$app/forms';
  import { Trash2, X } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
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
  let texture = $state<TextureKey | null>(data.entry.texture);
  let texturePristine = $state(false);
  // svelte-ignore state_referenced_locally
  let notes = $state(data.entry.notes ?? '');
  let saving = $state(false);
  let deleteOpen = $state(false);

  // Meal mode: a mutable per-member copy of each ingredient's reaction, seeded
  // once from the loaded meal (mirrors the single-entry `reaction` above).
  // svelte-ignore state_referenced_locally
  let mealMembers = $state((data.meal?.members ?? []).map((mem) => ({ ...mem })));

  // STATIC snapshot of each member's reaction AT LOAD TIME — deliberately a
  // plain object (NOT $state), built once and never reassigned. Task 9's
  // `update` action only writes a member's reaction when the submitted
  // `reaction.{id}` differs from `reactionLoaded.{id}`. If this snapshot
  // tracked the same mutable value as the picker above instead of freezing
  // it, submitted would always equal loaded and that guard would never fire —
  // reaction edits would silently no-op. See task-10-brief.md.
  // svelte-ignore state_referenced_locally
  const mealReactionsLoaded: Record<number, string> = Object.fromEntries(
    (data.meal?.members ?? []).map((mem) => [mem.id, mem.reaction])
  );

  let mealSaving = $state(false);
  let mealDeleteOpen = $state(false);

  const backHref = $derived(
    data.from === 'dashboard' ? `/child/${data.child.id}` : `/child/${data.child.id}/foods`
  );
</script>

{#if data.meal}
  <div class="mx-auto w-full px-4 max-w-xl space-y-5 py-6">
    <BackHeader
      title={m.mealEditTitle()}
      subtitle={m.logFormSubtitle({ name: data.child.name })}
      fallback={backHref}
    />

    <form
      method="POST"
      action="?/update"
      class="grid gap-5"
      use:enhance={({ formData }) => {
        mealSaving = true;
        const rawGivenAt = formData.get('givenAt');
        if (typeof rawGivenAt === 'string') {
          formData.set('givenAt', localInputToIso(rawGivenAt));
        }
        return async ({ update }) => {
          await update();
          mealSaving = false;
        };
      }}
    >
      {#if form?.error}
        <FormError>{form.error}</FormError>
      {/if}

      <input type="hidden" name="from" value={data.from} />

      <div class="grid gap-1.5">
        <Label for="mealGivenAt">{m.logFormGivenAtLabel()}</Label>
        <Input
          id="mealGivenAt"
          name="givenAt"
          type="datetime-local"
          bind:value={givenAt}
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
              <!-- name+value ON THE BUTTON (not a per-row hidden input): every
                   row's ReactionPicker/reactionLoaded shares this one form, so a
                   hidden input named "removeId" in each row would collide --
                   FormData always resolves to the FIRST same-named field,
                   regardless of which row's button was clicked. A submit
                   button's own name/value pair is only included for the button
                   that actually triggered the submit (SvelteKit's enhance builds
                   `new FormData(form, event.submitter)`; native no-JS submission
                   follows the same rule), so this is the one carrier that can't
                   collide across rows. -->
              <Button
                type="submit"
                name="removeId"
                value={member.id}
                formaction="?/removeIngredient"
                formnovalidate
                variant="ghost"
                size="sm"
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
    </form>

    <div class="border-t pt-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="text-severe-text hover:text-severe-text"
        onclick={() => (mealDeleteOpen = true)}
      >
        <Trash2 size={16} aria-hidden="true" />
        {m.mealEditDelete()}
      </Button>
    </div>
  </div>

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

    <form
      method="POST"
      action="?/update"
      class="grid gap-5"
      use:enhance={({ formData }) => {
        saving = true;
        const rawGivenAt = formData.get('givenAt');
        if (typeof rawGivenAt === 'string') {
          formData.set('givenAt', localInputToIso(rawGivenAt));
        }
        return async ({ update }) => {
          await update();
          saving = false;
        };
      }}
    >
      {#if form?.error}
        <FormError>{form.error}</FormError>
      {/if}

      <input type="hidden" name="from" value={data.from} />

      <FoodCombobox foods={data.foods} initialFoodId={data.entry.foodId} />

      <div class="grid gap-1.5">
        <Label for="givenAt">{m.logFormGivenAtLabel()}</Label>
        <Input id="givenAt" name="givenAt" type="datetime-local" bind:value={givenAt} required />
      </div>

      <div class="grid gap-1.5">
        <Label>{m.logFormReactionLegend()}</Label>
        <ReactionPicker name="reaction" bind:value={reaction} />
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
    </form>

    <div class="border-t pt-5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="text-severe-text hover:text-severe-text"
        onclick={() => (deleteOpen = true)}
      >
        <Trash2 size={16} aria-hidden="true" />
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
