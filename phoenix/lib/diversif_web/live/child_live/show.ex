defmodule DiversifWeb.ChildLive.Show do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Allergens, Catalog.Categories, Children, Logbook}

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} = membership <-
           Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      recent = Logbook.list_entries_for_child(child_id) |> Enum.take(20)
      stats = Logbook.stats_for_child(child_id)

      {:ok,
       socket
       |> assign(:page_title, child.name)
       |> assign(:child, child)
       |> assign(:role, membership.role)
       |> assign(:recent_entries, recent)
       |> assign(:stats, stats)
       |> assign(:total_categories, length(Categories.all()) - 1)
       |> assign(:total_allergens, Allergens.total())}
    else
      _ ->
        {:ok,
         socket
         |> put_flash(:error, "Enfant introuvable.")
         |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} wide>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold">{@child.name}</h1>
          <p class="text-sm text-zinc-500">Né(e) le {@child.birth_date}</p>
        </div>
        <.link
          navigate={~p"/child/#{@child.id}/log"}
          class="rounded bg-zinc-900 text-white px-3 py-2 text-sm font-medium"
        >
          Ajouter un aliment
        </.link>
      </div>

      <section class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <.stat label="Aliments" value={@stats.distinct_foods} />
        <.stat label="Repas loggés" value={@stats.entry_count} />
        <.stat label="Catégories" value={"#{@stats.distinct_categories} / #{@total_categories}"} />
        <.stat label="Allergènes" value={"#{@stats.distinct_allergens} / #{@total_allergens}"} />
      </section>

      <h2 class="text-lg font-semibold mb-3">Derniers repas</h2>

      <div :if={@recent_entries == []} class="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        Pas encore de repas loggé.
      </div>

      <ul class="space-y-2">
        <li :for={entry <- @recent_entries}>
          <.link
            navigate={~p"/child/#{@child.id}/foods/#{entry.id}"}
            class="block rounded border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">{entry.food.name}</div>
                <div class="text-sm text-zinc-500">
                  {Calendar.strftime(entry.given_at, "%d/%m/%Y %H:%M")} · {Categories.label(entry.food.category)}
                </div>
              </div>
              <.reaction_badge reaction={entry.reaction} />
            </div>
          </.link>
        </li>
      </ul>

      <p class="mt-6 text-sm">
        <.link navigate={~p"/child/#{@child.id}/foods"} class="underline">
          Historique complet
        </.link>
        ·
        <.link navigate={~p"/child/#{@child.id}/settings"} class="underline">
          Paramètres
        </.link>
        <span :if={@role == "owner"}>
          ·
          <.link navigate={~p"/child/#{@child.id}/invite"} class="underline">Inviter</.link>
        </span>
      </p>
    </Layouts.app>
    """
  end

  attr :label, :string, required: true
  attr :value, :any, required: true

  defp stat(assigns) do
    ~H"""
    <div class="rounded border border-zinc-200 px-3 py-3">
      <div class="text-xs uppercase tracking-wide text-zinc-500">{@label}</div>
      <div class="mt-1 text-xl font-semibold">{@value}</div>
    </div>
    """
  end

  attr :reaction, :string, required: true

  defp reaction_badge(assigns) do
    ~H"""
    <span class={[
      "text-xs rounded-full px-2 py-1",
      @reaction == "ras" && "bg-emerald-100 text-emerald-800",
      @reaction == "inconfort" && "bg-amber-100 text-amber-800",
      @reaction == "reaction" && "bg-rose-100 text-rose-800"
    ]}>
      {label(@reaction)}
    </span>
    """
  end

  defp label("ras"), do: "RAS"
  defp label("inconfort"), do: "Inconfort"
  defp label("reaction"), do: "Réaction"
  defp label(other), do: other
end
