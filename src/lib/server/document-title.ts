import { SITE } from '#lib/seo.js';

/**
 * Give a served page the app-wide title when it renders none of its own, so
 * every page serves exactly one <title> (#483). PageTitle is the only
 * component that renders one: the app shell has none, and the root layout
 * renders none on the server. Svelte keeps a single <title> by its place in
 * the component tree, and a component `bind:` (AppShellBento's
 * `bind:open`) re-renders its subtree through a copy whose place reads -1,
 * so a layout title would beat the page's on every bento route.
 *
 * Svelte appends the page's <title> to its head output, which SvelteKit puts
 * at `%sveltekit.head%` in app.html, so only a title element before `</head>`
 * counts. SvelteKit 3.0.0 transforms the whole document in one call; a chunk
 * without `</head>`, which a version that flushes earlier would pass, goes
 * through unchanged.
 */
export function withFallbackTitle(html: string): string {
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1 || /<title>[^<]*<\/title>/.test(html.slice(0, headEnd))) return html;
  return `${html.slice(0, headEnd)}<title>${SITE.title}</title>${html.slice(headEnd)}`;
}
