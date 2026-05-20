defmodule DiversifWeb.ChildLive.History do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Categories, Children, Logbook}

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      entries = Logbook.list_entries_for_child(child_id)

      {:ok,
       socket
       |> assign(:page_title, "Historique — #{child.name}")
       |> assign(:child, child)
       |> assign(:entries, entries)}
    else
      _ -> {:ok, socket |> put_flash(:error, "Enfant introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} wide>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold">Historique — {@child.name}</h1>
        <.link navigate={~p"/child/#{@child.id}"} class="text-sm underline">Retour</.link>
      </div>

      <div :if={@entries == []} class="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        Aucun repas pour l'instant.
      </div>

      <table :if={@entries != []} class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
          <tr>
            <th class="py-2">Date</th>
            <th>Aliment</th>
            <th>Catégorie</th>
            <th>Réaction</th>
          </tr>
        </thead>
        <tbody>
          <tr :for={e <- @entries} class="border-b border-zinc-100 hover:bg-zinc-50">
            <td class="py-2 whitespace-nowrap">{Calendar.strftime(e.given_at, "%d/%m/%Y %H:%M")}</td>
            <td>
              <.link navigate={~p"/child/#{@child.id}/foods/#{e.id}"} class="underline">
                {e.food.name}
              </.link>
            </td>
            <td class="text-zinc-500">{Categories.label(e.food.category)}</td>
            <td>{label(e.reaction)}</td>
          </tr>
        </tbody>
      </table>
    </Layouts.app>
    """
  end

  defp label("ras"), do: "RAS"
  defp label("inconfort"), do: "Inconfort"
  defp label("reaction"), do: "Réaction"
  defp label(other), do: other
end
