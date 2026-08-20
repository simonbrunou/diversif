<script lang="ts">
  import { Check, X } from 'lucide-svelte';
  import { TEXTURE_VALUES, type TextureKey } from '$lib/utils/textures';
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

  let {
    name,
    value = $bindable<TextureKey | null>(null),
    ageMonths,
    pristine = $bindable<boolean>(true)
  }: {
    name: string;
    value?: TextureKey | null;
    ageMonths?: number;
    pristine?: boolean;
  } = $props();

  const TILE: Record<TextureKey, { tint: string; tintHover: string; ring: string; text: string }> =
    {
      lisse: {
        tint: 'bg-tile-peach/30 border-tile-peach/50',
        tintHover: 'hover:bg-tile-peach/40 hover:border-tile-peach/60',
        ring: 'border-tile-peach-foreground ring-tile-peach/40 bg-tile-peach/60',
        text: 'text-tile-peach-foreground'
      },
      moulinee: {
        tint: 'bg-tile-butter/30 border-tile-butter/50',
        tintHover: 'hover:bg-tile-butter/40 hover:border-tile-butter/60',
        ring: 'border-tile-butter-foreground ring-tile-butter/40 bg-tile-butter/60',
        text: 'text-tile-butter-foreground'
      },
      ecrasee: {
        tint: 'bg-tile-mint/30 border-tile-mint/50',
        tintHover: 'hover:bg-tile-mint/40 hover:border-tile-mint/60',
        ring: 'border-tile-mint-foreground ring-tile-mint/40 bg-tile-mint/60',
        text: 'text-tile-mint-foreground'
      },
      'petits-morceaux': {
        tint: 'bg-tile-sky/30 border-tile-sky/50',
        tintHover: 'hover:bg-tile-sky/40 hover:border-tile-sky/60',
        ring: 'border-tile-sky-foreground ring-tile-sky/40 bg-tile-sky/60',
        text: 'text-tile-sky-foreground'
      },
      morceaux: {
        tint: 'bg-tile-lilac/30 border-tile-lilac/50',
        tintHover: 'hover:bg-tile-lilac/40 hover:border-tile-lilac/60',
        ring: 'border-tile-lilac-foreground ring-tile-lilac/40 bg-tile-lilac/60',
        text: 'text-tile-lilac-foreground'
      },
      finger: {
        tint: 'bg-primary/5 border-primary/20',
        tintHover: 'hover:bg-primary/10 hover:border-primary/30',
        ring: 'border-primary ring-primary/30 bg-primary/10',
        text: 'text-primary-strong'
      }
    };

  function onPick() {
    pristine = false;
  }
  function onClear() {
    value = null;
    pristine = false;
  }
</script>

<fieldset class="grid grid-cols-3 gap-2 sm:grid-cols-6">
  <legend class="sr-only">{m.textureLegend()}</legend>
  {#each TEXTURE_VALUES as k (k)}
    {@const active = value === k}
    {@const s = TILE[k]}
    <label
      class={cn(
        'group relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all duration-base ease-soft',
        'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
        s.tint,
        s.text,
        active
          ? cn(s.ring, 'border-2 ring-2 -translate-y-0.5 shadow-card motion-reduce:transform-none')
          : s.tintHover
      )}
    >
      <input
        type="radio"
        {name}
        value={k}
        bind:group={value}
        onchange={onPick}
        class="sr-only"
      />
      {#if active}
        <span
          class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current"
          aria-hidden="true"
        >
          <Check size={11} strokeWidth={3} class="text-background" />
        </span>
      {/if}
      <span class={cn('text-xs', active ? 'font-semibold' : 'font-medium')}>
        {getTextureLabel(k)}
      </span>
    </label>
  {/each}
</fieldset>

{#if pristine && ageMonths != null}
  <p class="mt-1 text-[11px] text-muted-foreground">
    {m.textureDefaultHint({ ageMonths: String(Math.floor(ageMonths)) })}
  </p>
{/if}

<button
  type="button"
  onclick={onClear}
  disabled={value == null}
  class="mt-1 inline-flex min-h-11 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
  aria-label={m.textureClearAria()}
>
  <X size={11} />
  {m.textureClear()}
</button>
