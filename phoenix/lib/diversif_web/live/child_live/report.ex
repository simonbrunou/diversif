defmodule DiversifWeb.ChildLive.Report do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Categories, Children, Logbook}

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      events = Logbook.reaction_report_for_child(child_id)

      {:ok,
       socket
       |> assign(:page_title, "Bilan — #{child.name}")
       |> assign(:child, child)
       |> assign(:events, events)}
    else
      _ -> {:ok, socket |> put_flash(:error, "Enfant introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2 print:hidden">
        <.link navigate={~p"/child/#{@child.id}"} class="underline">← {@child.name}</.link>
      </p>

      <h1 class="text-2xl font-semibold mb-2">Bilan médical — {@child.name}</h1>
      <p class="text-sm text-zinc-500 mb-6">
        Né(e) le {@child.birth_date}. Imprimable pour consultation médicale.
      </p>

      <div :if={@events == []} class="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        Aucune réaction ni symptôme enregistré.
      </div>

      <section :for={e <- @events} class="rounded border border-zinc-200 p-4 mb-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-semibold">{e.food.name}</h2>
            <p class="text-xs text-zinc-500">
              {Calendar.strftime(e.given_at, "%d/%m/%Y %H:%M")} · {Categories.label(e.food.category)}
            </p>
          </div>
          <span class={[
            "text-xs rounded-full px-2 py-1",
            e.reaction == "inconfort" && "bg-amber-100 text-amber-800",
            e.reaction == "reaction" && "bg-rose-100 text-rose-800",
            e.reaction == "ras" && "bg-zinc-100 text-zinc-700"
          ]}>
            {label(e.reaction)}
          </span>
        </div>

        <p :if={e.notes} class="mt-2 text-sm text-zinc-700">{e.notes}</p>

        <ul :if={e.symptoms != []} class="mt-3 text-sm">
          <li :for={s <- e.symptoms} class="border-l-2 border-rose-300 pl-3 py-1">
            <div class="font-medium">{symptom_label(s.label)}</div>
            <div class="text-xs text-zinc-500">
              {Calendar.strftime(s.observed_at, "%d/%m/%Y %H:%M")}
            </div>
            <div :if={s.note} class="text-xs text-zinc-700">{s.note}</div>
          </li>
        </ul>
      </section>

      <button onclick="window.print()" class="mt-6 print:hidden rounded border border-zinc-300 px-3 py-2 text-sm">
        Imprimer
      </button>
    </Layouts.app>
    """
  end

  defp label("ras"), do: "RAS"
  defp label("inconfort"), do: "Inconfort"
  defp label("reaction"), do: "Réaction"
  defp label(other), do: other

  @symptom_labels %{
    "rougeur" => "Rougeur",
    "urticaire" => "Urticaire",
    "eczema" => "Eczéma",
    "vomissement" => "Vomissement",
    "diarrhee" => "Diarrhée",
    "gonflement" => "Gonflement",
    "toux" => "Toux",
    "detresse-respiratoire" => "Détresse respiratoire",
    "levres-bleues" => "Lèvres bleues",
    "autre" => "Autre"
  }

  defp symptom_label(id), do: Map.get(@symptom_labels, id, id)
end
