<script lang="ts">
  import Dialog from '$components/ui/Dialog.svelte';
  import Button from '$components/ui/Button.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import SourceCitation from './SourceCitation.svelte';
  import { ALLERGEN_GUIDANCE } from '$lib/content/guidance';
  import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
  import { CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-svelte';

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

<Dialog
  open={open}
  onclose={close}
  title={label ? `Allergène : ${label}` : ''}
  class="max-w-lg"
>
  {#if guidance}
    <div class="space-y-4 text-sm">
      <div class="flex items-center gap-2">
        <Badge variant="default">
          Dès {guidance.recommendedAgeMonths} mois
        </Badge>
        <span class="text-xs text-muted-foreground">Allergène majeur</span>
      </div>

      <div>
        <h3 class="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={16} class="text-primary" aria-hidden="true" />
          Pourquoi tôt ?
        </h3>
        <p class="mt-1 text-foreground/90">{guidance.why}</p>
      </div>

      <div>
        <h3 class="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 size={16} class="text-reaction-ras" aria-hidden="true" />
          Comment l'introduire
        </h3>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-foreground/90">
          {#each guidance.howToOffer as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle size={16} class="text-reaction-inconfort" aria-hidden="true" />
          Premiers signes à surveiller
        </h3>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-foreground/90">
          {#each guidance.firstSigns as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
      </div>

      <div class="rounded-md border border-reaction-reaction/30 bg-reaction-reaction/5 p-3">
        <h3 class="flex items-center gap-2 text-sm font-semibold text-reaction-reaction">
          <AlertTriangle size={16} aria-hidden="true" />
          Signes sévères — appeler le 15
        </h3>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-foreground/90">
          {#each guidance.severeSigns as item, i (i)}
            <li>{item}</li>
          {/each}
        </ul>
        <p class="mt-2 text-foreground/90">{guidance.whatToDo}</p>
      </div>

      <div>
        <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sources
        </div>
        <SourceCitation ids={[...guidance.sources]} />
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={close}>Fermer</Button>
  {/snippet}
</Dialog>
