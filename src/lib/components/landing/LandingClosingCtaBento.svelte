<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<section class="bg-primary px-6 py-14 text-primary-foreground sm:px-10">
  <div class="mx-auto max-w-3xl text-center">
    <h2 class="font-display text-2xl italic">{m.landingClosingCtaTitle()}</h2>
    <a
      href={localizedHref('/signup')}
      class="mt-6 inline-block rounded-full bg-surface px-6 py-3 text-sm font-bold text-primary shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
    >
      {m.landingClosingCtaButton()}
    </a>
  </div>
</section>
