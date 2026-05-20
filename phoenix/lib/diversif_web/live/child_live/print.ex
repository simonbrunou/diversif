defmodule DiversifWeb.ChildLive.Print do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Categories, Children, Logbook}

  @impl true
  def mount(%{"id" => id, "entry_id" => entry_id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         {eid, ""} <- Integer.parse(entry_id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id),
         %{} = entry <- Logbook.get_entry(eid),
         true <- entry.child_id == child_id do
      {:ok,
       socket
       |> assign(:page_title, "Imprimer — #{entry.food.name}")
       |> assign(:child, child)
       |> assign(:entry, entry), layout: false}
    else
      _ -> {:ok, push_navigate(socket, to: ~p"/")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="max-w-2xl mx-auto p-8 print:p-0">
      <header class="border-b border-zinc-300 pb-4 mb-6">
        <h1 class="text-2xl font-semibold">{@child.name} — fiche repas</h1>
        <p class="text-sm text-zinc-500">Né(e) le {@child.birth_date}</p>
      </header>

      <section class="mb-6">
        <h2 class="text-lg font-semibold">{@entry.food.name}</h2>
        <p class="text-sm text-zinc-600">
          {Calendar.strftime(@entry.given_at, "%d/%m/%Y à %H:%M")} ·
          {Categories.label(@entry.food.category)} ·
          Réaction&nbsp;: {label(@entry.reaction)}
        </p>
      </section>

      <section :if={@entry.notes} class="mb-6">
        <h3 class="font-medium mb-1">Notes</h3>
        <p class="text-sm whitespace-pre-wrap">{@entry.notes}</p>
      </section>

      <section :if={@entry.symptoms != []}>
        <h3 class="font-medium mb-2">Symptômes observés</h3>
        <ul class="space-y-2 text-sm">
          <li :for={s <- @entry.symptoms} class="border-l-2 border-zinc-300 pl-3">
            <div class="font-medium">{symptom_label(s.label)}</div>
            <div class="text-xs text-zinc-500">{Calendar.strftime(s.observed_at, "%d/%m/%Y %H:%M")}</div>
            <div :if={s.note} class="mt-1">{s.note}</div>
          </li>
        </ul>
      </section>

      <footer class="mt-12 pt-4 border-t border-zinc-300 text-xs text-zinc-500">
        Document généré par diversif — ne remplace pas un avis médical.
      </footer>
    </div>
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
