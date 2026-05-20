defmodule DiversifWeb.AllergensLive do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Allergens, Children, Logbook}

  @impl true
  def mount(_params, _session, socket) do
    rows = Children.list_children_for_user(socket.assigns.current_user.id)

    per_child =
      Enum.map(rows, fn %{child: c} ->
        %{child: c, status: Logbook.allergen_status_for_child(c.id)}
      end)

    {:ok,
     socket
     |> assign(:page_title, "Allergènes")
     |> assign(:per_child, per_child)
     |> assign(:priority, Allergens.priority_introduction())}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} wide>
      <h1 class="text-2xl font-semibold mb-2">Suivi des allergènes</h1>
      <p class="text-sm text-zinc-600 mb-6">
        Les 12 allergènes du règlement UE 1169/2011. Les allergènes marqués «&nbsp;tôt&nbsp;» sont ceux
        pour lesquels les études LEAP / EAT / HCSP 2020 soutiennent une introduction précoce (4–6 mois).
      </p>

      <div :if={@per_child == []} class="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        Aucun enfant à suivre.
      </div>

      <section :for={%{child: c, status: status} <- @per_child} class="mb-8">
        <h2 class="text-lg font-semibold mb-3">
          <.link navigate={~p"/child/#{c.id}"} class="hover:underline">{c.name}</.link>
        </h2>

        <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <li :for={a <- status} class={[
            "rounded border px-3 py-3 text-sm",
            a.count > 0 && "border-emerald-200 bg-emerald-50",
            a.count == 0 && "border-zinc-200 bg-white"
          ]}>
            <div class="flex items-center justify-between">
              <span class="font-medium">{a.label}</span>
              <span :if={a.allergen in @priority} class="text-xs uppercase tracking-wide text-amber-700">tôt</span>
            </div>
            <div :if={a.count > 0} class="mt-1 text-xs text-zinc-600">
              {a.count} repas · 1er&nbsp;: {Calendar.strftime(a.first_at, "%d/%m/%Y")}
            </div>
            <div :if={a.count == 0} class="mt-1 text-xs text-zinc-500">
              Pas encore introduit
            </div>
          </li>
        </ul>
      </section>
    </Layouts.app>
    """
  end
end
