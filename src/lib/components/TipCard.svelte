<script lang="ts" module>
  export type TipTone = 'info' | 'warn' | 'important' | 'celebrate';

  const TONES: Record<TipTone, { wrapper: string; eyebrow: string; iconBg: string }> = {
    info: {
      wrapper: 'border-accent-sky/40 bg-accent-sky/15 dark:bg-accent-sky/10',
      // `text-info` is the sky background hue (≈1.2:1 on the sky-tinted
      // wrapper). `text-info-foreground` is the deep navy paired text color.
      eyebrow: 'text-info-foreground',
      iconBg: 'bg-accent-sky/40 dark:bg-accent-sky/15 text-info-foreground'
    },
    warn: {
      wrapper: 'border-reaction-inconfort/30 bg-reaction-inconfort/10',
      // Same fix as `info`: the bare reaction-inconfort token is the butter
      // background hue. The `-foreground` variant is the dark readable text.
      eyebrow: 'text-reaction-inconfort-foreground',
      iconBg: 'bg-reaction-inconfort/20 text-reaction-inconfort-foreground'
    },
    important: {
      wrapper: 'border-primary/40 bg-accent',
      eyebrow: 'text-primary-strong',
      iconBg: 'bg-primary text-primary-foreground'
    },
    celebrate: {
      wrapper: 'border-accent-butter/50 bg-accent-butter/25 dark:bg-accent-butter/10',
      eyebrow: 'text-tile-butter-foreground',
      iconBg: 'bg-accent-butter/60 dark:bg-accent-butter/20 text-tile-butter-foreground'
    }
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Icon as LucideIcon } from 'lucide-svelte';
  import { Lightbulb } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';
  import SourceCitation from './SourceCitation.svelte';
  import type { SourceId } from '$lib/content/sources';

  let {
    tone = 'info',
    eyebrow = 'Conseil',
    title,
    body,
    icon = Lightbulb,
    sources,
    class: className = '',
    children
  }: {
    tone?: TipTone;
    eyebrow?: string;
    title?: string;
    body?: string;
    icon?: typeof LucideIcon;
    sources?: SourceId[];
    class?: string;
    children?: Snippet;
  } = $props();

  const t = $derived(TONES[tone]);
  const Icon = $derived(icon);
</script>

<div class={cn('flex gap-3 rounded-lg border p-4', t.wrapper, className)}>
  <div class={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', t.iconBg)}>
    <Icon size={18} aria-hidden="true" />
  </div>
  <div class="min-w-0 flex-1">
    {#if eyebrow}
      <div class={cn('text-[11px] font-semibold uppercase tracking-wider', t.eyebrow)}>
        {eyebrow}
      </div>
    {/if}
    {#if title}
      <h3 class="mt-0.5 text-sm font-semibold leading-snug">{title}</h3>
    {/if}
    {#if body}
      <p class="mt-1 text-sm leading-relaxed text-foreground/90">{body}</p>
    {/if}
    {#if children}
      <div class="mt-2 text-sm leading-relaxed text-foreground/90">{@render children()}</div>
    {/if}
    {#if sources && sources.length > 0}
      <div class="mt-2">
        <SourceCitation ids={sources} inline />
      </div>
    {/if}
  </div>
</div>
