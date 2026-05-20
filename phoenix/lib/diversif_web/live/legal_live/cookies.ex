defmodule DiversifWeb.LegalLive.Cookies do
  use DiversifWeb, :live_view

  def mount(_params, _session, socket), do: {:ok, assign(socket, :page_title, "Cookies")}

  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <article class="prose max-w-none">
        <h1>Cookies</h1>
        <p>
          Diversif utilise uniquement des cookies strictement nécessaires au fonctionnement&nbsp;:
          session de connexion et challenge WebAuthn. Aucun cookie publicitaire ou de mesure
          tierce n'est déposé.
        </p>
      </article>
    </Layouts.app>
    """
  end
end
