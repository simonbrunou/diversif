<script lang="ts">
  let { size = 44, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<div
  aria-label="Diversif"
  role="img"
  class="relative inline-block overflow-hidden rounded-2xl shadow-soft {className}"
  style="width: {size}px; height: {size}px"
>
  <div class="absolute inset-y-0 left-0 w-1/2 bg-primary"></div>
  <div class="absolute inset-y-0 right-0 w-1/2 bg-tile-peach"></div>
</div>
