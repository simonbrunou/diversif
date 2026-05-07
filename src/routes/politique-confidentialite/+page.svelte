<script lang="ts">
  import Seo from '$lib/components/Seo.svelte';
  import { languageTag } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const legal = $derived(data.legal);
</script>

<Seo
  title="Politique de confidentialité · Diversif"
  description="Comment Diversif traite vos données personnelles : finalités, bases légales, durées de conservation, droits RGPD."
  path="/politique-confidentialite"
  noindex
/>

<div class="container max-w-3xl space-y-6 py-8 md:py-12">
  {#if languageTag() === 'en'}
    <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      {m.commonFrOnlyBannerLegal()}
    </aside>
  {/if}

  <section lang="fr" class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">Politique de confidentialité</h1>
      <p class="text-sm text-muted-foreground">Dernière mise à jour : 6 mai 2026.</p>
    </header>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">1. Responsable de traitement</h2>
    <p class="text-sm">
      {legal.controllerName}, joignable à
      <a class="underline" href={`mailto:${legal.controllerEmail}`}>{legal.controllerEmail}</a>.
      Adresse postale : {legal.controllerAddress}.
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">2. Finalités et bases légales</h2>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>
        <span class="font-medium">Tenir un compte parent</span> (email, nom d'usage, mot de passe haché) :
        exécution du contrat (article 6.1.b RGPD).
      </li>
      <li>
        <span class="font-medium">Suivre la diversification alimentaire d'un enfant</span> (prénom et
        date de naissance de l'enfant, journal des aliments, observations de réactions, notes) :
        exécution du contrat. Ces données peuvent relever de l'article 9 RGPD (santé d'un mineur) ;
        elles sont traitées sur la base du <strong>consentement explicite</strong> du parent
        (article 9.2.a) recueilli à l'inscription.
      </li>
      <li>
        <span class="font-medium">Partager le suivi avec un co-parent</span> (invitations, appartenances) :
        exécution du contrat.
      </li>
      <li>
        <span class="font-medium">Sécurité du compte</span> (sessions, clés d'accès WebAuthn,
        défis WebAuthn éphémères) : intérêt légitime à protéger les comptes.
      </li>
    </ul>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">3. Catégories de données collectées</h2>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>Compte parent : email, nom d'usage, mot de passe haché (Argon2id), horodatages d'acceptation des CGU et de la politique, horodatage de dernière connexion.</li>
      <li>Enfant : prénom et date de naissance.</li>
      <li>Journal d'aliments : aliment, date, observation (« RAS », « inconfort », « réaction »), notes libres.</li>
      <li>Sessions et clés d'accès : identifiants opaques, métadonnées WebAuthn (type d'appareil, transports, compteur de signature).</li>
      <li>Invitations : code à durée limitée, identifiants du créateur et de l'utilisateur ayant accepté.</li>
    </ul>
    <p class="text-sm">
      Aucun cookie de mesure d'audience, aucune adresse IP et aucun User-Agent ne sont
      enregistrés dans la base applicative. Un service tiers de remontée d'erreurs techniques
      (voir section 4) reçoit, en cas de panne, une trace technique sans identifiant utilisateur.
    </p>
  </section>

  <!-- Optional follow-up: append Sentry GmbH's full street address from
       https://sentry.io/legal/dpa/ if the policy needs more precision than
       "Berlin, Allemagne". -->
  <section class="space-y-2">
    <h2 class="text-lg font-semibold">4. Destinataires et sous-traitants</h2>
    <p class="text-sm">
      Les données applicatives (compte, enfants, journal, sessions) sont stockées dans une base
      SQLite hébergée par {legal.hostProvider}. Aucun tiers de mesure d'audience, de publicité,
      de suivi commercial, d'e-mail, de notification ou de CDN ne reçoit vos données. Les
      co-parents auxquels vous transmettez un code d'invitation accèdent au journal de l'enfant
      correspondant.
    </p>
    <p class="text-sm">
      Un seul sous-traitant technique reçoit des données strictement limitées :
    </p>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>
        <span class="font-medium">Sentry GmbH</span> (entité européenne de Functional Software,
        Inc., siège social à Berlin, Allemagne) — collecte des erreurs techniques produites
        par l'application (trace d'exécution, route SvelteKit anonymisée, identifiant d'erreur
        opaque). Aucun identifiant utilisateur, aucune adresse e-mail, aucun corps de requête,
        aucun cookie ni en-tête ne sont transmis. Base légale : intérêt légitime à corriger les
        pannes (article 6.1.f RGPD). Données hébergées en Union européenne (région Francfort).
        Durée de conservation : 90 jours. Lien :
        <a class="underline" href="https://sentry.io/legal/dpa/" target="_blank" rel="noopener noreferrer">accord de traitement (DPA)</a>.
      </li>
    </ul>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">5. Durées de conservation</h2>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>Compte et journaux : tant que le compte est actif. Un compte sans connexion depuis {legal.retentionInactiveDays} jours peut être identifié comme obsolète et supprimé manuellement par l'éditeur.</li>
      <li>Sessions : 30 jours ; renouvellement automatique en cas d'usage.</li>
      <li>Invitations : 7 jours (purgées automatiquement après expiration).</li>
      <li>Défis WebAuthn : 5 minutes (purgés automatiquement).</li>
      <li>Suppression du compte : effectuée immédiatement, sans délai, à la demande de l'utilisateur via la page « Mon compte ».</li>
    </ul>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">6. Vos droits</h2>
    <p class="text-sm">
      Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants : accès,
      rectification, effacement, limitation, opposition, portabilité, retrait du consentement.
    </p>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li><span class="font-medium">Accès et portabilité</span> : depuis « Mon compte », exportez vos données au format JSON.</li>
      <li><span class="font-medium">Rectification</span> : depuis « Mon compte » et la fiche de l'enfant.</li>
      <li><span class="font-medium">Effacement</span> : depuis « Mon compte », bouton « Supprimer mon compte ».</li>
      <li><span class="font-medium">Toute autre demande</span> : par e-mail à <a class="underline" href={`mailto:${legal.controllerEmail}`}>{legal.controllerEmail}</a>.</li>
    </ul>
    <p class="text-sm">
      Vous pouvez à tout moment introduire une réclamation auprès de la
      <a class="underline" href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer">CNIL</a>.
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">7. Mineurs</h2>
    <p class="text-sm">
      Diversif est destiné à des parents et personnes responsables d'un enfant. La création d'un
      compte est réservée aux personnes de 15 ans ou plus (article 45 de la loi Informatique et
      Libertés). Les données concernant l'enfant sont traitées sous la responsabilité du parent
      titulaire du compte.
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">8. Sécurité</h2>
    <p class="text-sm">
      Les mots de passe sont hachés avec Argon2id. Les communications sont chiffrées en HTTPS.
      L'application utilise des en-têtes de sécurité (CSP, HSTS, X-Frame-Options, Referrer-Policy,
      Permissions-Policy). Les clés d'accès WebAuthn sont prises en charge.
    </p>
  </section>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold">9. Transferts hors Union européenne</h2>
      <p class="text-sm">
        Aucun transfert hors Union européenne n'est effectué tant que l'hébergement reste assuré
        par {legal.hostProvider}.
      </p>
    </section>
  </section>
</div>
