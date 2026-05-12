<script lang="ts" module>
  export type TipTone = 'info' | 'warn' | 'important' | 'celebrate';

  const TONES: Record<TipTone, { wrapper: string; eyebrow: string; iconBg: string }> = {
    info: {
      wrapper: 'border-accent-sky/40 bg-accent-sky/15 dark:bg-accent-sky/10',
      eyebrow: 'text-info',
      iconBg: 'bg-accent-sky/40 dark:bg-accent-sky/15 text-info'
    },
    warn: {
      wrapper: 'border-reaction-inconfort/30 bg-reaction-inconfort/10',
      eyebrow: 'text-reaction-inconfort',
      iconBg: 'bg-reaction-inconfort/20 text-reaction-inconfort'
    },
    important: {
      wrapper: 'border-primary/40 bg-accent',
      eyebrow: 'text-primary-strong',
      iconBg: 'bg-primary text-primary-foreground'
    },
    celebrate: {
      wrapper: 'border-accent-butter/50 bg-accent-butter/25 dark:bg-accent-butter/10',
      eyebrow: 'text-[hsl(35_70%_30%)] dark:text-accent-butter',
      iconBg:
        'bg-accent-butter/60 dark:bg-accent-butter/20 text-[hsl(35_70%_28%)] dark:text-accent-butter'
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
