defmodule DiversifWeb.ChildLive.Entry do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Categories, Children, Logbook}

  @symptom_labels [
    {"rougeur", "Rougeur"},
    {"urticaire", "Urticaire"},
    {"eczema", "Eczéma"},
    {"vomissement", "Vomissement"},
    {"diarrhee", "Diarrhée"},
    {"gonflement", "Gonflement"},
    {"toux", "Toux"},
    {"detresse-respiratoire", "Détresse respiratoire"},
    {"levres-bleues", "Lèvres bleues"},
    {"autre", "Autre"}
  ]

  @impl true
  def mount(%{"id" => id, "entry_id" => entry_id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         {eid, ""} <- Integer.parse(entry_id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id),
         %{} = entry <- Logbook.get_entry(eid),
         true <- entry.child_id == child_id do
      symptoms = Logbook.list_symptoms_for_entry(eid)

      form =
        to_form(%{"label" => "rougeur", "note" => "", "observed_at" => ""}, as: :symptom)

      {:ok,
       socket
       |> assign(:page_title, entry.food.name)
       |> assign(:child, child)
       |> assign(:entry, entry)
       |> assign(:symptoms, symptoms)
       |> assign(:symptom_labels, @symptom_labels)
       |> assign(:form, form)}
    else
      _ -> {:ok, socket |> put_flash(:error, "Repas introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def handle_event("add_symptom", %{"symptom" => params}, socket) do
    %{child: child, entry: entry} = socket.assigns

    observed_at =
      case NaiveDateTime.from_iso8601(params["observed_at"] || "") do
        {:ok, naive} -> DateTime.from_naive!(naive, "Etc/UTC")
        _ -> DateTime.utc_now()
      end

    attrs = %{
      "food_entry_id" => entry.id,
      "child_id" => child.id,
      "label" => params["label"],
      "note" => (params["note"] || "") |> String.trim() |> then(&if &1 == "", do: nil, else: &1),
      "observed_at" => observed_at,
      "created_by" => socket.assigns.current_user.id
    }

    case Logbook.create_symptom(attrs) do
      {:ok, _} ->
        symptoms = Logbook.list_symptoms_for_entry(entry.id)

        {:noreply,
         socket
         |> assign(:symptoms, symptoms)
         |> put_flash(:info, "Symptôme ajouté.")}

      {:error, _cs} ->
        {:noreply, put_flash(socket, :error, "Symptôme invalide.")}
    end
  end

  def handle_event("delete_symptom", %{"id" => id}, socket) do
    with {sid, ""} <- Integer.parse(id),
         sym when sym != nil <- Enum.find(socket.assigns.symptoms, &(&1.id == sid)),
         {:ok, _} <- Logbook.delete_symptom(sym) do
      symptoms = Logbook.list_symptoms_for_entry(socket.assigns.entry.id)
      {:noreply, assign(socket, :symptoms, symptoms)}
    else
      _ -> {:noreply, put_flash(socket, :error, "Impossible de supprimer.")}
    end
  end

  def handle_event("delete_entry", _, socket) do
    case Logbook.delete_entry(socket.assigns.entry) do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, "Repas supprimé.")
         |> push_navigate(to: ~p"/child/#{socket.assigns.child.id}")}

      _ ->
        {:noreply, put_flash(socket, :error, "Suppression impossible.")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2">
        <.link navigate={~p"/child/#{@child.id}"} class="underline">← {@child.name}</.link>
      </p>

      <h1 class="text-2xl font-semibold mb-2">{@entry.food.name}</h1>
      <p class="text-sm text-zinc-500 mb-6">
        {Calendar.strftime(@entry.given_at, "%d/%m/%Y %H:%M")} ·
        {Categories.label(@entry.food.category)} ·
        Réaction&nbsp;: {label(@entry.reaction)}
      </p>

      <section :if={@entry.notes} class="mb-6 rounded border border-zinc-200 p-3 text-sm">
        {@entry.notes}
      </section>

      <h2 class="text-lg font-semibold mb-3">Symptômes</h2>

      <ul :if={@symptoms != []} class="space-y-2 mb-6">
        <li :for={s <- @symptoms} class="rounded border border-zinc-200 px-3 py-2 text-sm flex justify-between items-center">
          <div>
            <div class="font-medium">{symptom_label(s.label)}</div>
            <div class="text-xs text-zinc-500">{Calendar.strftime(s.observed_at, "%d/%m/%Y %H:%M")}</div>
            <div :if={s.note} class="text-xs text-zinc-600 mt-1">{s.note}</div>
          </div>
          <button
            phx-click="delete_symptom"
            phx-value-id={s.id}
            data-confirm="Supprimer ce symptôme ?"
            class="text-rose-600 underline text-xs"
          >
            Supprimer
          </button>
        </li>
      </ul>

      <.form for={@form} phx-submit="add_symptom" class="space-y-3 mb-8">
        <div>
          <label class="block text-sm font-medium mb-1">Type</label>
          <select name="symptom[label]" class="w-full rounded border border-zinc-300 px-3 py-2">
            <option :for={{id, label} <- @symptom_labels} value={id}>{label}</option>
          </select>
        </div>
        <.input field={@form[:observed_at]} type="datetime-local" label="Observé à (optionnel)" />
        <.input field={@form[:note]} type="textarea" label="Note (optionnel)" />
        <button type="submit" class="rounded bg-zinc-900 text-white px-3 py-2 text-sm font-medium">
          Ajouter un symptôme
        </button>
      </.form>

      <button
        phx-click="delete_entry"
        data-confirm="Supprimer ce repas et ses symptômes ?"
        class="text-rose-600 underline text-sm"
      >
        Supprimer ce repas
      </button>
    </Layouts.app>
    """
  end

  defp label("ras"), do: "RAS"
  defp label("inconfort"), do: "Inconfort"
  defp label("reaction"), do: "Réaction"
  defp label(other), do: other

  defp symptom_label(id) do
    case List.keyfind(@symptom_labels, id, 0) do
      {_, label} -> label
      nil -> id
    end
  end
end
