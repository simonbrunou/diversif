<script lang="ts">
  import DiscoverGroup from './DiscoverGroup.svelte';
  let { label, tint }: { label: string; tint: 'mint' | 'peach' | 'butter' } = $props();
</script>

<DiscoverGroup {label} {tint}>
  <div data-testid="child-content">slotted</div>
</DiscoverGroup>
