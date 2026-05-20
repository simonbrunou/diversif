defmodule DiversifWeb.ChildLive.Log do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Categories, Children, Logbook}

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
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      foods = Logbook.list_foods_for_child(child_id)

      now_local =
        DateTime.utc_now()
        |> DateTime.to_naive()
        |> NaiveDateTime.truncate(:second)
        |> NaiveDateTime.to_iso8601()

      form =
        to_form(
          %{
            "food_id" => "",
            "custom_name" => "",
            "custom_category" => "autre",
            "given_at" => now_local,
            "reaction" => "ras",
            "texture" => "",
            "notes" => ""
          },
          as: :entry
        )

      {:ok,
       socket
       |> assign(:page_title, "Ajouter un aliment")
       |> assign(:child, child)
       |> assign(:foods, foods)
       |> assign(:reactions, @reactions)
       |> assign(:textures, @textures)
       |> assign(:categories, Categories.options_for_select())
       |> assign(:form, form)}
    else
      _ -> {:ok, socket |> put_flash(:error, "Enfant introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def handle_event("validate", %{"entry" => params}, socket) do
    {:noreply, assign(socket, :form, to_form(params, as: :entry))}
  end

  def handle_event("save", %{"entry" => params}, socket) do
    %{child: child} = socket.assigns
    user_id = socket.assigns.current_user.id

    with {:ok, food_id} <- resolve_food_id(params, child.id),
         {:ok, given_at} <- parse_given_at(params["given_at"]),
         attrs = %{
           "child_id" => child.id,
           "food_id" => food_id,
           "given_at" => given_at,
           "reaction" => params["reaction"],
           "texture" => normalize_texture(params["texture"]),
           "notes" => normalize_notes(params["notes"]),
           "logged_by" => user_id
         },
         {:ok, _entry} <- Logbook.create_entry(attrs) do
      {:noreply,
       socket
       |> put_flash(:info, "Repas ajouté.")
       |> push_navigate(to: ~p"/child/#{child.id}")}
    else
      {:error, message} when is_binary(message) ->
        {:noreply, put_flash(socket, :error, message)}

      {:error, %Ecto.Changeset{} = cs} ->
        {:noreply, put_flash(socket, :error, summarize(cs))}
    end
  end

  defp resolve_food_id(%{"food_id" => fid}, _child_id) when fid not in ["", nil] do
    case Integer.parse(fid) do
      {n, ""} -> {:ok, n}
      _ -> {:error, "Aliment invalide."}
    end
  end

  defp resolve_food_id(%{"custom_name" => name} = params, child_id) when name not in ["", nil] do
    category = if params["custom_category"] in [nil, ""], do: "autre", else: params["custom_category"]

    case Diversif.Logbook.create_custom_food(child_id, %{
           "name" => String.trim(name),
           "category" => category
         }) do
      {:ok, food} -> {:ok, food.id}
      {:error, cs} -> {:error, summarize(cs)}
    end
  end

  defp resolve_food_id(_, _), do: {:error, "Choisissez un aliment ou créez-en un."}

  defp parse_given_at(value) when is_binary(value) and value != "" do
    case NaiveDateTime.from_iso8601(value) do
      {:ok, naive} ->
        {:ok, DateTime.from_naive!(naive, "Etc/UTC")}

      {:error, _} ->
        case NaiveDateTime.from_iso8601(value <> ":00") do
          {:ok, naive} -> {:ok, DateTime.from_naive!(naive, "Etc/UTC")}
          _ -> {:error, "Date invalide."}
        end
    end
  end

  defp parse_given_at(_), do: {:error, "Date requise."}

  defp normalize_texture(""), do: nil
  defp normalize_texture(nil), do: nil
  defp normalize_texture(t), do: t

  defp normalize_notes(nil), do: nil
  defp normalize_notes(""), do: nil
  defp normalize_notes(s), do: String.trim(s)

  defp summarize(%Ecto.Changeset{} = cs) do
    cs
    |> Ecto.Changeset.traverse_errors(fn {msg, _opts} -> msg end)
    |> Enum.map(fn {f, [msg | _]} -> "#{f}: #{msg}" end)
    |> Enum.join(", ")
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <h1 class="text-2xl font-semibold mb-6">Ajouter un aliment pour {@child.name}</h1>

      <.form for={@form} phx-change="validate" phx-submit="save" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Aliment</label>
          <select
            name="entry[food_id]"
            class="w-full rounded border border-zinc-300 px-3 py-2"
          >
            <option value="">— Choisir dans le catalogue —</option>
            <option :for={f <- @foods} value={f.id} selected={to_string(f.id) == @form[:food_id].value}>
              {f.name}
            </option>
          </select>
          <p class="mt-1 text-xs text-zinc-500">
            Ou créer un aliment personnalisé&nbsp;:
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <.input field={@form[:custom_name]} type="text" label="Nouvel aliment" />
          <div>
            <label class="block text-sm font-medium mb-1">Catégorie</label>
            <select name="entry[custom_category]" class="w-full rounded border border-zinc-300 px-3 py-2">
              <option :for={{label, id} <- @categories} value={id} selected={id == @form[:custom_category].value}>
                {label}
              </option>
            </select>
          </div>
        </div>

        <.input field={@form[:given_at]} type="datetime-local" label="Date et heure" required />

        <div>
          <label class="block text-sm font-medium mb-1">Réaction</label>
          <div class="flex gap-2">
            <label :for={{value, label} <- @reactions} class={[
              "flex-1 cursor-pointer rounded border px-3 py-2 text-center text-sm",
              @form[:reaction].value == value && "border-zinc-900 bg-zinc-900 text-white",
              @form[:reaction].value != value && "border-zinc-300"
            ]}>
              <input type="radio" name="entry[reaction]" value={value} class="sr-only"
                     checked={@form[:reaction].value == value} />
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

        <.input field={@form[:notes]} type="textarea" label="Notes (optionnel)" />

        <div class="flex gap-2">
          <button type="submit" class="rounded bg-zinc-900 text-white px-4 py-2 font-medium">
            Enregistrer
          </button>
          <.link navigate={~p"/child/#{@child.id}"} class="rounded border border-zinc-300 px-4 py-2 font-medium">
            Annuler
          </.link>
        </div>
      </.form>
    </Layouts.app>
    """
  end
end
