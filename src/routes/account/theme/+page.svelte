<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import ThemeToggle from '$components/ThemeToggle.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<BackHeader title={m.authAccountAppearanceSection()} />

<div class="space-y-3">
  <p class="text-sm text-ink-soft">{m.authAccountAppearanceDescription()}</p>
  <ThemeToggle />
</div>
