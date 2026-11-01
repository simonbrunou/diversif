<script lang="ts">
  import PageTitle from '#lib/components/PageTitle.svelte';
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import ThemeToggle from '#lib/components/ThemeToggle.svelte';
  import * as m from '#lib/paraglide/messages.js';
  import { SITE } from '#lib/seo.js';
</script>

<PageTitle title={`${m.authAccountAppearanceSection()} · ${SITE.name}`} />
<BackHeader title={m.authAccountAppearanceSection()} />

<div class="space-y-3">
  <p class="text-sm text-ink-soft">{m.authAccountAppearanceDescription()}</p>
  <ThemeToggle />
</div>
