<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import {
    TEXTURE_VALUES,
    defaultTextureForAgeMonths,
    type TextureKey
  } from '$lib/utils/textures';
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import { CheckCircle2, Circle, MapPin, UtensilsCrossed } from 'lucide-svelte';

  let {
    ageMonths,
    progress
  }: {
    ageMonths: number;
    progress: { tried: string[]; mostRecent: string | null };
  } = $props();

  // The ordered ladder: lisse → moulinee → ecrasee → petits-morceaux → morceaux.
  // `finger` is parallel — rendered as its own side row, never as a default for an age.
  const LADDER: readonly TextureKey[] = TEXTURE_VALUES.filter((t) => t !== 'finger');

  const triedSet = $derived(new Set(progress.tried));
  const expected = $derived(defaultTextureForAgeMonths(ageMonths));
  const mostRecent = $derived(progress.mostRecent);
  const fingerTried = $derived(triedSet.has('finger'));

  function captionFor(step: TextureKey): string {
    if (mostRecent === step) return m.textureTimelineStateRecent();
    if (expected === step) return m.textureTimelineStateExpected();
    if (triedSet.has(step)) return m.textureTimelineStateTried();
    return m.textureTimelineStateUpcoming();
  }

  function iconFor(step: TextureKey) {
    if (mostRecent === step) return MapPin;
    if (triedSet.has(step)) return CheckCircle2;
    return Circle;
  }
</script>

<section class="mb-3">
  <SectionHeader>{m.textureTimelineTitle()}</SectionHeader>
  <p class="-mt-1 mb-3 text-xs text-ink-soft">
    {m.textureTimelineSubtitle({
      months: String(ageMonths),
      label: getTextureLabel(expected)
    })}
  </p>

  <ol class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
    {#each LADDER as step, i (step)}
      {@const Icon = iconFor(step)}
      {@const isExpected = expected === step}
      {@const isRecent = mostRecent === step}
      {@const isTried = triedSet.has(step)}
      <li class="flex min-w-[7.5rem] flex-1 snap-start flex-col">
        <span class="mb-1 text-[10px] uppercase tracking-wide text-ink-soft">
          {i + 1}
        </span>
        <div
          class={cn(
            'flex h-full flex-col gap-1 rounded-tile border bg-canvas p-3 shadow-soft transition-colors',
            isRecent && 'border-primary bg-accent',
            !isRecent && isExpected && 'border-primary/40',
            !isRecent && !isExpected && isTried && 'border-success/40',
            !isRecent && !isExpected && !isTried && 'border-dashed border-border'
          )}
        >
          <span class="flex items-center justify-between">
            <span class="text-sm font-bold leading-tight">{getTextureLabel(step)}</span>
            <Icon
              size={14}
              aria-hidden="true"
              class={cn(
                isRecent && 'text-primary',
                !isRecent && isTried && 'text-success',
                !isRecent && !isTried && 'text-ink-soft'
              )}
            />
          </span>
          <span class="text-[11px] uppercase tracking-wide text-ink-soft">
            {captionFor(step)}
          </span>
        </div>
      </li>
    {/each}
  </ol>

  <div
    class={cn(
      'mt-3 flex items-start gap-3 rounded-tile border bg-canvas p-3 shadow-soft',
      fingerTried ? 'border-success/40' : 'border-dashed border-border'
    )}
  >
    <span
      class={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2',
        fingerTried && 'text-success'
      )}
    >
      <UtensilsCrossed size={18} aria-hidden="true" />
    </span>
    <span class="min-w-0 flex-1">
      <p class="text-sm font-bold leading-tight">{m.textureTimelineFingerLabel()}</p>
      <p class="text-xs text-ink-soft">{m.textureTimelineFingerHint()}</p>
    </span>
  </div>
</section>
