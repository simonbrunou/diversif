<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<nav aria-label={m.chromeLegalLinksLabel()} class="grid gap-1 text-sm text-muted-foreground">
  <a href={localizedHref('/mentions-legales')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksMentionsLegales()}</a>
  <a href={localizedHref('/politique-confidentialite')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksPolitiqueConfidentialite()}</a>
  <a href={localizedHref('/cgu')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksConditions()}</a>
  <a href={localizedHref('/cookies')} class="hover:text-foreground hover:underline">{m.chromeLegalLinksCookies()}</a>
</nav>
