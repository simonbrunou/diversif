<script lang="ts">
  let { data }: { data: unknown } = $props();
  // Escape `<` to defuse any closing-tag injection from data-driven content,
  // and pre-build the wrapping <script> tag as plain strings so the Svelte
  // ESLint parser doesn't try to read the inner tag as TypeScript.
  const OPEN = '<' + 'script type="application/ld+json">';
  const CLOSE = '</' + 'script>';
  const html = $derived(OPEN + JSON.stringify(data).replace(/</g, '\\u003c') + CLOSE);
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</svelte:head>
