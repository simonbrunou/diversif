<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tint = 'mint' | 'peach' | 'butter';

  let {
    label,
    tint,
    children
  }: {
    label: string;
    tint: Tint;
    children: Snippet;
  } = $props();
</script>

<section class="discover-group" data-tint={tint} aria-label={label}>
  <p class="discover-group__label" aria-hidden="true">{label}</p>
  {@render children()}
</section>
