defmodule DiversifWeb.HomeLive do
  use DiversifWeb, :live_view

  alias Diversif.Children

  @impl true
  def mount(_params, _session, socket) do
    rows = Children.list_children_for_user(socket.assigns.current_user.id)

    {:ok,
     socket
     |> assign(:page_title, "Mes enfants")
     |> assign(:children_rows, rows)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold">Mes enfants</h1>
        <.link
          navigate={~p"/child/new"}
          class="rounded bg-zinc-900 text-white px-3 py-2 text-sm font-medium"
        >
          Ajouter un enfant
        </.link>
      </div>

      <div :if={@children_rows == []} class="rounded border border-dashed border-zinc-300 p-8 text-center">
        <p class="text-zinc-600 mb-4">
          Aucun enfant pour l'instant. Créez-en un pour commencer le suivi.
        </p>
        <.link
          navigate={~p"/child/new"}
          class="inline-block rounded bg-zinc-900 text-white px-4 py-2 font-medium"
        >
          Créer un enfant
        </.link>
      </div>

      <ul class="space-y-2">
        <li :for={%{child: c, role: role} <- @children_rows}>
          <.link
            navigate={~p"/child/#{c.id}"}
            class="block rounded border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">{c.name}</div>
                <div class="text-sm text-zinc-500">Né(e) le {c.birth_date}</div>
              </div>
              <span class="text-xs uppercase tracking-wide text-zinc-500">{role}</span>
            </div>
          </.link>
        </li>
      </ul>
    </Layouts.app>
    """
  end
end
