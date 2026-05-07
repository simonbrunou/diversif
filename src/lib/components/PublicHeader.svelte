<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import LocaleSwitcher from './LocaleSwitcher.svelte';
  import { page } from '$app/stores';
  import type { SafeUser } from '$lib/types';
  import { Menu, X } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';

  let {
    user,
    firstChildId
  }: { user: SafeUser | null; firstChildId: number | null } = $props();

  let mobileOpen = $state(false);

  const navLinks = $derived([
    { href: localizedHref('/'), label: m.chromePublicHeaderNavHome() },
    { href: localizedHref('/guide'), label: m.chromePublicHeaderNavGuide() },
    { href: localizedHref('/allergens'), label: m.chromePublicHeaderNavAllergens() },
    { href: localizedHref('/sources'), label: m.chromePublicHeaderNavSources() }
  ]);

  const dashboardHref = $derived(
    firstChildId ? localizedHref(`/child/${firstChildId}`) : localizedHref('/')
  );

  function isActive(href: string): boolean {
    if (href === '/' || href === localizedHref('/')) return $page.url.pathname === href;
    return $page.url.pathname === href || $page.url.pathname.startsWith(`${href}/`);
  }
</script>

<header class="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
  <div class="container flex h-14 items-center justify-between gap-4 md:h-16">
    <a href={localizedHref('/')} class="inline-flex items-center gap-2 font-semibold text-foreground">
      <img src="/favicon.svg" alt="" class="h-7 w-7" aria-hidden="true" />
      <span>{m.chromePublicHeaderBrand()}</span>
    </a>

    <nav aria-label={m.chromePublicHeaderNavLabel()} class="hidden md:block">
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
        <Button href={dashboardHref} variant="outline" size="sm">{m.chromePublicHeaderMyDashboard()}</Button>
        <Button href={localizedHref('/account')} variant="ghost" size="sm">{m.chromePublicHeaderMyAccount()}</Button>
      {:else}
        <Button href={localizedHref('/login')} variant="ghost" size="sm">{m.chromePublicHeaderNavLogin()}</Button>
        <Button href={localizedHref('/signup')} size="sm">{m.chromePublicHeaderNavSignup()}</Button>
      {/if}
      <LocaleSwitcher />
    </div>

    <button
      type="button"
      class="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      aria-expanded={mobileOpen}
      aria-controls="public-mobile-nav"
      aria-label={mobileOpen ? m.chromePublicHeaderMenuClose() : m.chromePublicHeaderMenuOpen()}
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
            <Button href={dashboardHref} variant="outline" size="sm">{m.chromePublicHeaderMyDashboard()}</Button>
            <Button href={localizedHref('/account')} variant="ghost" size="sm">{m.chromePublicHeaderMyAccount()}</Button>
          {:else}
            <Button href={localizedHref('/login')} variant="ghost" size="sm">{m.chromePublicHeaderNavLogin()}</Button>
            <Button href={localizedHref('/signup')} size="sm">{m.chromePublicHeaderNavSignup()}</Button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</header>
