<script lang="ts" module>
  export type TipTone = 'info' | 'warn' | 'important' | 'celebrate';

  // A tinted card sets its tint's own foreground and everything inside
  // inherits it: the body, the children and the sources drop their ink and
  // grey (DESIGN.md, The Paired Foreground Rule). The lint cannot read these
  // script-held tints; TipCard.test.ts checks them.
  const TONES: Record<
    TipTone,
    { wrapper: string; eyebrow: string; iconBg: string; body: string; sources: string }
  > = {
    info: {
      // `text-info` is the sky background hue (≈1.2:1 on the sky-tinted
      // wrapper). `text-tile-sky-foreground` is the deep navy paired text.
      wrapper: 'border-accent-sky/40 bg-accent-sky/15 dark:bg-accent-sky/10 text-tile-sky-foreground',
      eyebrow: '',
      iconBg: 'bg-accent-sky/40 dark:bg-accent-sky/15 text-tile-sky-foreground',
      body: '',
      sources: 'text-current'
    },
    warn: {
      // Same as `info`: the bare reaction-inconfort token is the butter
      // background hue. The `-foreground` variant is the dark readable text.
      wrapper:
        'border-reaction-inconfort/30 bg-reaction-inconfort/10 text-reaction-inconfort-foreground',
      eyebrow: '',
      iconBg: 'bg-reaction-inconfort/20 text-reaction-inconfort-foreground',
      body: '',
      sources: 'text-current'
    },
    important: {
      wrapper: 'border-primary/40 bg-accent',
      eyebrow: 'text-primary-strong',
      iconBg: 'bg-primary text-primary-foreground',
      body: 'text-foreground/90',
      sources: ''
    },
    celebrate: {
      wrapper:
        'border-accent-butter/50 bg-accent-butter/25 dark:bg-accent-butter/10 text-tile-butter-foreground',
      eyebrow: '',
      iconBg: 'bg-accent-butter/60 dark:bg-accent-butter/20 text-tile-butter-foreground',
      body: '',
      sources: 'text-current'
    }
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { LucideIcon } from '@lucide/svelte';
  import { Lightbulb } from '@lucide/svelte';
  import { cn } from '#lib/utils/cn.js';
  import SourceCitation from './SourceCitation.svelte';
  import type { SourceId } from '#lib/content/sources.js';

  let {
    tone = 'info',
    // Opt-in, and never alongside a title. An eyebrow above a heading is
    // decoration: the heading already carries its own weight. The two
    // title-less callers (the log-form tip, the suggestions tip) use it as
    // that card's only label, which is a legitimate use.
    eyebrow,
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
    icon?: LucideIcon;
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
      <div class={cn('text-2xs font-semibold uppercase tracking-wider', t.eyebrow)}>
        {eyebrow}
      </div>
    {/if}
    {#if title}
      <h3 class="mt-0.5 text-sm font-semibold leading-snug">{title}</h3>
    {/if}
    {#if body}
      <p class={cn('mt-1 text-sm leading-relaxed', t.body)}>{body}</p>
    {/if}
    {#if children}
      <div class={cn('mt-2 text-sm leading-relaxed', t.body)}>{@render children()}</div>
    {/if}
    {#if sources && sources.length > 0}
      <div class="mt-2">
        <SourceCitation ids={sources} inline class={t.sources} />
      </div>
    {/if}
  </div>
</div>
