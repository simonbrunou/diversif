defmodule DiversifWeb.GuideLive do
  use DiversifWeb, :live_view

  @impl true
  def mount(_params, _session, socket), do: {:ok, assign(socket, :page_title, "Guide")}

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <article class="prose max-w-none">
        <h1>Guide de diversification</h1>
        <p class="text-sm text-zinc-500">
          Recommandations basées sur HCSP 2020, LEAP 2015, EAT 2016 et ESPGHAN 2017.
        </p>

        <h2>Quand commencer&nbsp;?</h2>
        <p>
          La diversification alimentaire se fait entre <strong>4 et 6 mois révolus</strong>,
          jamais avant 4 mois ni au-delà de 6 mois pour les allergènes majeurs.
        </p>

        <h2>Comment&nbsp;?</h2>
        <ul>
          <li>Un seul nouvel aliment à la fois, sur 3 jours, pour repérer une réaction.</li>
          <li>Texture initiale&nbsp;: <em>lisse</em>, puis évolution progressive.</li>
          <li>Allergènes prioritaires (œuf, arachide, lait, gluten) à introduire <em>tôt</em>.</li>
          <li>Pas de sel ajouté, pas de sucre avant 1 an.</li>
        </ul>

        <h2>Textures par âge (repère)</h2>
        <ul>
          <li>4–6 mois&nbsp;: lisse</li>
          <li>6–7 mois&nbsp;: moulinée</li>
          <li>7–9 mois&nbsp;: écrasée</li>
          <li>9–12 mois&nbsp;: petits morceaux</li>
          <li>12 mois et +&nbsp;: morceaux</li>
        </ul>

        <p>
          <.link navigate={~p"/sources"} class="underline">Sources scientifiques</.link>
        </p>
      </article>
    </Layouts.app>
    """
  end
end
