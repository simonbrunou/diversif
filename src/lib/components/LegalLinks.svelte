<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { i18n } from '$lib/i18n';
  import { languageTag } from '$lib/paraglide/runtime';

  function localizedHref(path: string): string {
    return i18n.resolveRoute(path, languageTag());
  }
</script>

<nav aria-label={m.chromeLegalLinksLabel()} class="grid gap-1 text-sm text-muted-foreground">
  <a href={localizedHref('/mentions-legales')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksMentionsLegales()}</a>
  <a href={localizedHref('/politique-confidentialite')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksPolitiqueConfidentialite()}</a>
  <a href={localizedHref('/cgu')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksConditions()}</a>
  <a href={localizedHref('/cookies')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksCookies()}</a>
</nav>
