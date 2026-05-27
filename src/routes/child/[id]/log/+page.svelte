<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Label from '$components/ui/Label.svelte';
  import Textarea from '$components/ui/Textarea.svelte';
  import FormError from '$components/ui/FormError.svelte';
  import BackHeader from '$components/ui/BackHeader.svelte';
  import FoodCombobox from '$lib/components/FoodCombobox.svelte';
  import ReactionPicker from '$lib/components/ReactionPicker.svelte';
  import TexturePicker from '$lib/components/TexturePicker.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import { defaultTextureForAgeMonths, type TextureKey } from '$lib/utils/textures';
  import { formatDateInputValue, localInputToIso } from '$lib/utils/dates';
  import { ageInMonths } from '$lib/utils/age';
  import { getTipsFor, pickRotatingTip } from '$lib/content/guidance';
  import { page } from '$app/state';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { enqueue } from '$lib/offline/queue';
  import { newId } from '$lib/offline/uuid';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';
  import { Info } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';

  let {
    data,
    form
  }: { data: PageData; form: ActionData } = $props();

  let givenAt = $state(formatDateInputValue());
  let reaction = $state<'ras' | 'inconfort' | 'reaction'>('ras');
  // svelte-ignore state_referenced_locally
  let texture = $state<TextureKey | null>(
    defaultTextureForAgeMonths(ageInMonths(data.child.birthDate, new Date(givenAt)))
  );
  let texturePristine = $state(true);
  let submitting = $state(false);

  $effect(() => {
    // While the user hasn't touched the picker, follow the meal date.
    if (!texturePristine) return;
    texture = defaultTextureForAgeMonths(
      ageInMonths(data.child.birthDate, new Date(givenAt))
    );
  });

  const initialFoodId = (() => {
    const v = Number(page.url.searchParams.get('foodId'));
    return Number.isInteger(v) && v > 0 ? v : null;
  })();

  // Surface a stage-relevant tip below the form
  const months = $derived(ageInMonths(data.child.birthDate));
  const tip = $derived(pickRotatingTip(getTipsFor({ ageMonths: months }), data.child.id + 7));
</script>

<div class="container max-w-xl space-y-5 py-6">
  <BackHeader
    title={m.logFormTitle()}
    subtitle={m.logFormSubtitle({ name: data.child.name })}
    fallback={`/child/${data.child.id}`}
  />

  <form
    method="POST"
    class="grid gap-5"
    use:enhance={({ formData, cancel }) => {
      if (submitting) {
        cancel();
        return async () => {};
      }
      submitting = true;
      const rawGivenAt = formData.get('givenAt');
      if (typeof rawGivenAt === 'string') {
        formData.set('givenAt', localInputToIso(rawGivenAt));
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        cancel();
        const formObj: Record<string, string> = {};
        formData.forEach((value, key) => {
          if (typeof value === 'string') formObj[key] = value;
        });
        void (async () => {
          try {
            await enqueue({
              key: newId(),
              childId: data.child.id,
              formData: formObj,
              queuedAt: Date.now()
            });
          } catch {
            toast.error(m.offlineQueueFailedToast());
            submitting = false;
            return;
          }
          toast.success(m.offlineQueuedToast());
          submitting = false;
          // The entry is durably queued. Navigation is best-effort : if the dashboard
          // route isn't cached and we're truly offline, goto() may reject; the queued
          // row still syncs when we're back online.
          await goto(`/child/${data.child.id}`).catch(() => {
            /* best-effort navigation */
          });
        })();
        return async () => {};
      }
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    {#if form?.error}
      <FormError>{form.error}</FormError>
    {/if}

    <FoodCombobox foods={data.foods} {initialFoodId} />

    <Field name="givenAt" label={m.logFormGivenAtLabel()}>
      <Input id="givenAt" name="givenAt" type="datetime-local" bind:value={givenAt} required />
    </Field>

    <div class="grid gap-1.5">
      <Label>{m.logFormReactionLegend()}</Label>
      <ReactionPicker name="reaction" bind:value={reaction} />
      <details class="mt-1 rounded-md border bg-muted/40 p-2 text-xs">
        <summary class="flex cursor-pointer items-center gap-1.5 font-medium text-foreground/80">
          <Info size={12} aria-hidden="true" />
          {m.logFormReactionHelpToggle()}
        </summary>
        <ul class="mt-2 space-y-1.5 pl-4 text-muted-foreground">
          <li>
            <strong class="text-reaction-ras">{m.logFormReactionHelpRasBold()}</strong> : {m.logFormReactionHelpRasText()}
          </li>
          <li>
            <strong class="text-reaction-inconfort">{m.logFormReactionHelpInconfortBold()}</strong> : {m.logFormReactionHelpInconfortText()}
          </li>
          <li>
            <strong class="text-reaction-reaction">{m.logFormReactionHelpReactionBold()}</strong> : {m.logFormReactionHelpReactionText1()}
            <strong>{m.logFormReactionHelpReactionStopBold()}</strong> {m.logFormReactionHelpReactionText2()}
          </li>
        </ul>
      </details>
    </div>

    <div class="grid gap-1.5">
      <Label>{m.textureLabel()}</Label>
      <TexturePicker
        name="texture"
        bind:value={texture}
        bind:pristine={texturePristine}
        ageMonths={ageInMonths(data.child.birthDate, new Date(givenAt))}
      />
    </div>

    <Field name="notes" label={m.logFormNoteLabel()}>
      <Textarea
        id="notes"
        name="notes"
        maxlength={2000}
        placeholder={m.logFormNotePlaceholder()}
      />
    </Field>

    <div class="flex gap-2">
      <Button type="submit" size="lg" class="flex-1" loading={submitting}>
        {submitting ? m.logFormSubmitting() : m.logFormSubmitCta()}
      </Button>
      <Button href={localizedHref(`/child/${data.child.id}`)} variant="outline" size="lg">{m.commonCancel()}</Button>
    </div>
  </form>

  {#if tip}
    <TipCard
      tone="info"
      eyebrow={m.logFormTipEyebrow()}
      body={tip.body}
      sources={tip.sources ? [...tip.sources] : undefined}
    />
  {/if}
</div>
