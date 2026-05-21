<script lang="ts">
  import DetailSheet from '$lib/components/ui/DetailSheet.svelte';
  import SheetSection from '$lib/components/ui/SheetSection.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import Button from '$components/ui/Button.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import SourceCitation from './SourceCitation.svelte';
  import { ALLERGEN_GUIDANCE } from '$lib/content/guidance';
  import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
  import { CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';

  let {
    allergenId = $bindable(null),
    onclose
  }: {
    allergenId?: AllergenId | null;
    onclose?: () => void;
  } = $props();

  const open = $derived(allergenId != null);
  const guidance = $derived(allergenId ? ALLERGEN_GUIDANCE[allergenId] : null);
  const label = $derived(allergenId ? ALLERGENS.find((a) => a.id === allergenId)?.label : '');

  function close() {
    allergenId = null;
    onclose?.();
  }
</script>

<DetailSheet
  open={open}
  onclose={close}
  title={label ? m.allergenDialogTitle({ label }) : ''}
  class="max-w-lg"
>
  {#if guidance}
    <div class="text-sm">
      <div class="flex items-center gap-2">
        <Badge variant="default">
          {m.allergenDialogBadgeFromMonths({ months: guidance.recommendedAgeMonths })}
        </Badge>
        <span class="text-xs text-muted-foreground">{m.allergenDialogSeverityMajor()}</span>
      </div>

      <SheetSection title={m.allergenDialogWhyEarlyTitle()} icon={ShieldCheck}>
        <p class="text-foreground/90">{guidance.why}</p>
      </SheetSection>

      <SheetSection title={m.allergenDialogHowToOfferTitle()} icon={CheckCircle2}>
        <ul class="list-disc space-y-1 pl-5 text-foreground/90">
          {#each guidance.howToOffer as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
      </SheetSection>

      <SheetSection title={m.allergenDialogFirstSignsTitle()} icon={AlertCircle}>
        <ul class="list-disc space-y-1 pl-5 text-foreground/90">
          {#each guidance.firstSigns as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
      </SheetSection>

      <SheetSection title={m.allergenDialogSevereSignsTitle()}>
        <Callout variant="warning">
          <ul class="list-disc space-y-1 pl-5">
            {#each guidance.severeSigns as item, i (i)}
              <li>{item}</li>
            {/each}
          </ul>
          <p class="mt-2">{guidance.whatToDo}</p>
        </Callout>
      </SheetSection>

      <SheetSection title={m.allergenDialogSourcesTitle()}>
        <SourceCitation ids={[...guidance.sources]} />
      </SheetSection>
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={close}>{m.allergenDialogClose()}</Button>
  {/snippet}
</DetailSheet>
