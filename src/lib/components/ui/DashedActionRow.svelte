<!--
  Dashed-border CTA row used for "add a child / invite a co-parent / add a
  symptom" actions across the bento. Renders as <a> when `href` is provided,
  otherwise as <button>. Pass `class` to tweak padding, width, or alignment;
  Tailwind's merge logic will let later utilities win.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Icon as LucideIcon } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';

  let {
    href,
    onclick,
    icon,
    iconSize = 16,
    type = 'button',
    class: className = '',
    children
  }: {
    href?: string;
    onclick?: () => void;
    icon: typeof LucideIcon;
    iconSize?: number;
    type?: 'button' | 'submit';
    class?: string;
    children: Snippet;
  } = $props();

  const baseClass =
    'inline-flex items-center gap-2 rounded-tile border border-dashed border-border bg-canvas px-3 py-2 text-sm font-semibold text-ink-soft transition-transform duration-base ease-soft active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none';

  const Icon = $derived(icon);
</script>

{#if href}
  <a {href} class={cn(baseClass, className)}>
    <Icon size={iconSize} aria-hidden="true" />
    {@render children()}
  </a>
{:else}
  <button {type} {onclick} class={cn(baseClass, className)}>
    <Icon size={iconSize} aria-hidden="true" />
    {@render children()}
  </button>
{/if}
