defmodule DiversifWeb.AccountLive.Export do
  use DiversifWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :page_title, "Exporter mes données")}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/account"} class="underline">← Mon compte</.link></p>
      <h1 class="text-2xl font-semibold mb-6">Exporter mes données</h1>
      <p class="text-sm text-zinc-600 mb-6">
        L'export RGPD (JSON de toutes vos données diversif) sera disponible prochainement.
      </p>
    </Layouts.app>
    """
  end
end
