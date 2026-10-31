<script module lang="ts">
  import { untrack } from 'svelte';
  import { SITE } from '#lib/seo.js';

  // The titles of the mounted PageTitle components, newest last. Only $effect
  // writes it, so it never holds anything on the server, where one module
  // instance serves every request.
  let claims = $state.raw<{ title: string }[]>([]);

  /**
   * The title the document should carry: the newest mounted page title, else
   * the app-wide one. The root layout writes it to `document.title`, which
   * brings the app-wide title back once the page that named itself unmounts:
   * Svelte sets `document.title` when a `<title>` mounts and never restores it.
   */
  export function currentTitle(): string {
    return claims.at(-1)?.title ?? SITE.title;
  }
</script>

<script lang="ts">
  let { title }: { title: string } = $props();

  // Claim on every title change, so a same-route navigation that renames the
  // page (SvelteKit does not remount it) keeps currentTitle() in step.
  $effect(() => {
    const claim = { title };
    untrack(() => (claims = [...claims, claim]));
    return () => {
      claims = claims.filter((c) => c !== claim);
    };
  });
</script>

<!-- The only <title> the server renders. A page without one gets the app-wide
     title from hooks.server.ts (see #lib/server/document-title.ts). -->
<svelte:head>
  <title>{title}</title>
</svelte:head>
