<script lang="ts">
  import { splitEmphasis } from '#lib/content/emphasis.js';

  // Prints a guidance string with its `**…**` text as <strong>. The <strong>
  // carries no colour class: inside a tint it inherits the tint's foreground
  // (DESIGN.md, The Paired Foreground Rule).
  let { text }: { text: string } = $props();

  const segments = $derived(splitEmphasis(text));
</script>

{#each segments as s, i (i)}{#if s.strong}<strong>{s.text}</strong>{:else}{s.text}{/if}{/each}
