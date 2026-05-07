<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import { page } from '$app/stores';
  import type { SafeUser } from '$lib/types';
  import { Menu, X } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';

  let {
    user,
    firstChildId
  }: { user: SafeUser | null; firstChildId: number | null } = $props();

  let mobileOpen = $state(false);

  const navLinks = [
    { href: '/', label: 'Accueil' },
    { href: '/guide', label: 'Guide' },
    { href: '/allergens', label: 'Allergènes' },
    { href: '/sources', label: 'Sources' }
  ] as const;

  const dashboardHref = $derived(firstChildId ? `/child/${firstChildId}` : '/');

  function isActive(href: string): boolean {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`);
  }
</script>

<header class="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
  <div class="container flex h-14 items-center justify-between gap-4 md:h-16">
    <a href="/" class="inline-flex items-center gap-2 font-semibold text-foreground">
      <img src="/favicon.svg" alt="" class="h-7 w-7" aria-hidden="true" />
      <span>{m.chromePublicHeaderBrand()}</span>
    </a>

    <nav aria-label="Navigation principale" class="hidden md:block">
      <ul class="flex items-center gap-1 text-sm">
        {#each navLinks as l (l.href)}
          <li>
            <a
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              class="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="hidden items-center gap-2 md:flex">
      {#if user}
        <Button href={dashboardHref} variant="outline" size="sm">Mon tableau</Button>
        <Button href="/account" variant="ghost" size="sm">Mon compte</Button>
      {:else}
        <Button href="/login" variant="ghost" size="sm">Se connecter</Button>
        <Button href="/signup" size="sm">Créer un compte</Button>
      {/if}
    </div>

    <button
      type="button"
      class="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      aria-expanded={mobileOpen}
      aria-controls="public-mobile-nav"
      aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      onclick={() => (mobileOpen = !mobileOpen)}
    >
      {#if mobileOpen}
        <X size={20} aria-hidden="true" />
      {:else}
        <Menu size={20} aria-hidden="true" />
      {/if}
    </button>
  </div>

  {#if mobileOpen}
    <div id="public-mobile-nav" class="border-t bg-background md:hidden">
      <div class="container space-y-1 py-3">
        <ul class="grid gap-1 text-sm">
          {#each navLinks as l (l.href)}
            <li>
              <a
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                onclick={() => (mobileOpen = false)}
                class="block rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
              >
                {l.label}
              </a>
            </li>
          {/each}
        </ul>
        <div class="flex flex-wrap gap-2 pt-2">
          {#if user}
            <Button href={dashboardHref} variant="outline" size="sm">Mon tableau</Button>
            <Button href="/account" variant="ghost" size="sm">Mon compte</Button>
          {:else}
            <Button href="/login" variant="ghost" size="sm">Se connecter</Button>
            <Button href="/signup" size="sm">Créer un compte</Button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</header>
