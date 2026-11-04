<script lang="ts">
  import { SOURCES, type SourceId } from '#lib/content/sources.js';
  import { ExternalLink } from '@lucide/svelte';
  import { cn } from '#lib/utils/cn.js';

  let {
    ids,
    inline = false,
    class: className = ''
  }: {
    ids: SourceId[];
    inline?: boolean;
    /** Merged into the list's classes, e.g. `text-current` on a tint. */
    class?: string;
  } = $props();

  const sources = $derived(ids.map((id) => ({ id, ...SOURCES[id] })));
</script>

{#if inline}
  <span class={cn('inline-flex flex-wrap gap-1 text-2xs text-muted-foreground', className)}>
    {#each sources as s, i (s.id)}
      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-0.5 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        title={s.label}
      >
        {s.org} ({s.year})
      </a>{#if i < sources.length - 1}<span aria-hidden="true">·</span>{/if}
    {/each}
  </span>
{:else}
  <ul class={cn('mt-2 space-y-1 text-2xs text-muted-foreground', className)}>
    {#each sources as s (s.id)}
      <li>
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          <span class="font-medium">{s.org}</span>
          <span>· {s.label} ({s.year})</span>
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </li>
    {/each}
  </ul>
{/if}
