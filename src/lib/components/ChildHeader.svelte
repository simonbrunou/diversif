<script lang="ts">
  import { formatAge } from '$lib/utils/age';

  let { name, birthDate }: { name: string; birthDate: string } = $props();
</script>

<header class="flex items-center justify-between gap-3">
  <div>
    <h1 class="text-2xl font-semibold leading-tight">{name}</h1>
    <p class="text-sm text-muted-foreground">{formatAge(birthDate)}</p>
  </div>
  <div class="flex items-center gap-2">
    <a
      href="/account"
      class="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      aria-label="Mon compte"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    </a>
  </div>
</header>
