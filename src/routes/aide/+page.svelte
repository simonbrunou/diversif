<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import Button from '$components/ui/Button.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<Seo
  title={m.aideSeoTitle()}
  description={m.aideSeoDescription()}
  path="/aide"
  alternateLocales={['en']}
/>

<div class="mx-auto w-full px-4 flex max-w-2xl flex-1 flex-col gap-4 py-8">
  <h1 class="text-2xl font-semibold">{m.aideTitle()}</h1>

  <Card class="p-5">
    <h2 class="text-lg font-semibold">{m.aideWhatTitle()}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{m.aideWhatBody()}</p>
  </Card>

  <Card class="p-5">
    <h2 class="text-lg font-semibold">{m.aideSharingTitle()}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{m.aideSharingBody()}</p>
  </Card>

  <Card class="p-5">
    <h2 class="text-lg font-semibold">{m.aideTrustTitle()}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{m.aideTrustBody()}</p>
    <div class="mt-3">
      <Button href={localizedHref('/sources')} variant="outline" size="sm">
        {m.aideSourcesCta()}
      </Button>
    </div>
  </Card>

  <Callout variant="info">{m.guideMedicalDisclaimer()}</Callout>
</div>
