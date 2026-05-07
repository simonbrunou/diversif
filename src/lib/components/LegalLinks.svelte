<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<nav aria-label={m.chromeLegalLinksLabel()} class="grid gap-1 text-sm text-muted-foreground">
  <a href="/mentions-legales" class="hover:text-foreground hover:underline">{m.chromeLegalLinksMentionsLegales()}</a>
  <a href="/politique-confidentialite" class="hover:text-foreground hover:underline">{m.chromeLegalLinksPolitiqueConfidentialite()}</a>
  <a href="/cgu" class="hover:text-foreground hover:underline">{m.chromeLegalLinksConditions()}</a>
  <a href="/cookies" class="hover:text-foreground hover:underline">{m.chromeLegalLinksCookies()}</a>
</nav>
