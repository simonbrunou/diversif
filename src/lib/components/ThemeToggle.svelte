<script lang="ts">
  import { onMount } from 'svelte';
  import { applyTheme, getStoredTheme, type Theme } from '$lib/utils/theme';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

  let theme = $state<Theme>('system');

  onMount(() => {
    theme = getStoredTheme();
  });

  function setTheme(next: Theme) {
    theme = next;
    applyTheme(next);
  }

  const options: { value: Theme; label: string }[] = [
    { value: 'light', label: m.profilCompteThemeValueLight() },
    { value: 'dark', label: m.profilCompteThemeValueDark() },
    { value: 'system', label: m.profilCompteThemeValueSystem() }
  ];
</script>

<div class="inline-flex rounded-md border border-input p-1">
  {#each options as opt (opt.value)}
    <button
      type="button"
      aria-pressed={theme === opt.value}
      onclick={() => setTheme(opt.value)}
      class={cn(
        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
        theme === opt.value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {opt.label}
    </button>
  {/each}
</div>
