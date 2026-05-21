<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import FormError from '$components/ui/FormError.svelte';
  import BackHeader from '$components/ui/BackHeader.svelte';
  import FoodCombobox from '$lib/components/FoodCombobox.svelte';
  import ReactionPicker from '$lib/components/ReactionPicker.svelte';
  import TexturePicker from '$lib/components/TexturePicker.svelte';
  import { formatDateInputValue, localInputToIso } from '$lib/utils/dates';
  import type { TextureKey } from '$lib/utils/textures';
  import { enhance } from '$app/forms';
  import { Trash2 } from 'lucide-svelte';
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
  let deleting = $state(false);

  const backHref = $derived(
    data.from === 'dashboard' ? `/child/${data.child.id}` : `/child/${data.child.id}/foods`
  );
</script>

<div class="container max-w-xl space-y-5 py-6">
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

  <form
    method="POST"
    action="?/delete"
    class="border-t pt-5"
    use:enhance={({ cancel }) => {
      if (!confirm(m.logEditDeleteConfirm())) {
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
      {deleting ? m.logEditDeleting() : m.logEditDeleteCta()}
    </Button>
  </form>
</div>
