defmodule DiversifWeb.ChildLive.Edit do
  use DiversifWeb, :live_view

  alias Diversif.{Children, Logbook}

  @reactions [{"ras", "RAS"}, {"inconfort", "Inconfort"}, {"reaction", "Réaction"}]
  @textures [
    {"", "—"},
    {"lisse", "Lisse"},
    {"moulinee", "Moulinée"},
    {"ecrasee", "Écrasée"},
    {"petits-morceaux", "Petits morceaux"},
    {"morceaux", "Morceaux"},
    {"finger", "Finger food"}
  ]

  @impl true
  def mount(%{"id" => id, "entry_id" => entry_id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         {eid, ""} <- Integer.parse(entry_id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id),
         %{} = entry <- Logbook.get_entry(eid),
         true <- entry.child_id == child_id do
      form =
        to_form(
          %{
            "reaction" => entry.reaction,
            "texture" => entry.texture || "",
            "notes" => entry.notes || "",
            "given_at" => DateTime.to_naive(entry.given_at) |> NaiveDateTime.to_iso8601()
          },
          as: :entry
        )

      {:ok,
       socket
       |> assign(:page_title, "Modifier — #{entry.food.name}")
       |> assign(:child, child)
       |> assign(:entry, entry)
       |> assign(:reactions, @reactions)
       |> assign(:textures, @textures)
       |> assign(:form, form)}
    else
      _ -> {:ok, socket |> put_flash(:error, "Repas introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def handle_event("save", %{"entry" => params}, socket) do
    given_at =
      case NaiveDateTime.from_iso8601(params["given_at"] || "") do
        {:ok, naive} -> DateTime.from_naive!(naive, "Etc/UTC")
        _ -> socket.assigns.entry.given_at
      end

    attrs = %{
      "given_at" => given_at,
      "reaction" => params["reaction"],
      "texture" => if(params["texture"] == "", do: nil, else: params["texture"]),
      "notes" =>
        (params["notes"] || "")
        |> String.trim()
        |> then(&if &1 == "", do: nil, else: &1)
    }

    case Logbook.update_entry(socket.assigns.entry, attrs) do
      {:ok, _entry} ->
        {:noreply,
         socket
         |> put_flash(:info, "Repas modifié.")
         |> push_navigate(to: ~p"/child/#{socket.assigns.child.id}/foods/#{socket.assigns.entry.id}")}

      {:error, cs} ->
        {:noreply, assign(socket, :form, to_form(cs, as: :entry))}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2">
        <.link navigate={~p"/child/#{@child.id}/foods/#{@entry.id}"} class="underline">← {@entry.food.name}</.link>
      </p>

      <h1 class="text-2xl font-semibold mb-6">Modifier {@entry.food.name}</h1>

      <.form for={@form} phx-submit="save" class="space-y-4">
        <.input field={@form[:given_at]} type="datetime-local" label="Date et heure" required />

        <div>
          <label class="block text-sm font-medium mb-1">Réaction</label>
          <div class="flex gap-2">
            <label :for={{value, label} <- @reactions} class={[
              "flex-1 cursor-pointer rounded border px-3 py-2 text-center text-sm",
              @form[:reaction].value == value && "border-zinc-900 bg-zinc-900 text-white",
              @form[:reaction].value != value && "border-zinc-300"
            ]}>
              <input type="radio" name="entry[reaction]" value={value} class="sr-only" checked={@form[:reaction].value == value} />
              {label}
            </label>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Texture</label>
          <select name="entry[texture]" class="w-full rounded border border-zinc-300 px-3 py-2">
            <option :for={{value, label} <- @textures} value={value} selected={value == @form[:texture].value}>
              {label}
            </option>
          </select>
        </div>

        <.input field={@form[:notes]} type="textarea" label="Notes" />

        <div class="flex gap-2">
          <button type="submit" class="rounded bg-zinc-900 text-white px-4 py-2 font-medium">
            Enregistrer
          </button>
          <.link navigate={~p"/child/#{@child.id}/foods/#{@entry.id}"} class="rounded border border-zinc-300 px-4 py-2 font-medium">
            Annuler
          </.link>
        </div>
      </.form>
    </Layouts.app>
    """
  end
end
