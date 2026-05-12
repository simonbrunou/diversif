<script lang="ts">
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<Seo title={m.authDeletedTitle()} path="/account/deleted" noindex alternateLocales={['en']} />

<div class="container flex max-w-md flex-1 flex-col justify-center py-10 text-center">
  <h1 class="text-2xl font-semibold">{m.authDeletedHeading()}</h1>
  <p class="mt-3 text-sm text-muted-foreground">
    {m.authDeletedBody()}
  </p>
  <p class="mt-6 text-sm">
    <a href={localizedHref('/')} class="font-medium text-primary-strong hover:underline">{m.authDeletedBackHome()}</a>
  </p>
</div>
