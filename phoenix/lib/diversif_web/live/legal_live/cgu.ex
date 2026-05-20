defmodule DiversifWeb.LegalLive.Cgu do
  use DiversifWeb, :live_view

  def mount(_params, _session, socket), do: {:ok, assign(socket, :page_title, "Conditions d'utilisation")}

  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <article class="prose max-w-none">
        <h1>Conditions d'utilisation</h1>
        <p>
          Diversif est un outil de suivi de la diversification alimentaire de votre enfant.
          Il ne remplace pas l'avis d'un professionnel de santé.
        </p>
        <h2>Usage</h2>
        <p>
          En créant un compte, vous vous engagez à utiliser Diversif pour votre propre suivi
          ou celui d'enfants dont vous avez la responsabilité parentale.
        </p>
        <h2>Données médicales</h2>
        <p>
          Les informations enregistrées (allergènes, réactions, symptômes) restent confidentielles
          et ne sont jamais partagées sans votre accord explicite.
        </p>
        <h2>Modification du service</h2>
        <p>
          Nous nous réservons le droit de modifier ces conditions ; vous serez notifié(e) en cas de
          changement substantiel.
        </p>
        <p class="text-sm text-zinc-500">Dernière mise à jour&nbsp;: 2026.</p>
      </article>
    </Layouts.app>
    """
  end
end
