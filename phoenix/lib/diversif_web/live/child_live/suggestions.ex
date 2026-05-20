defmodule DiversifWeb.ChildLive.Suggestions do
  use DiversifWeb, :live_view

  alias Diversif.{Catalog.Categories, Children, Logbook}

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      months = age_months(child.birth_date)
      all_suggestions = Logbook.suggestions_for_child(child_id)

      {age_appropriate, later} =
        if months do
          Enum.split_with(all_suggestions, &(&1.suggested_age_months <= months))
        else
          {all_suggestions, []}
        end

      {:ok,
       socket
       |> assign(:page_title, "Suggestions — #{child.name}")
       |> assign(:child, child)
       |> assign(:age_months, months)
       |> assign(:age_appropriate, age_appropriate)
       |> assign(:later, later)}
    else
      _ -> {:ok, socket |> put_flash(:error, "Enfant introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  defp age_months(birth_date) when is_binary(birth_date) do
    case Date.from_iso8601(birth_date) do
      {:ok, d} -> Date.diff(Date.utc_today(), d) |> div(30)
      _ -> nil
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user} wide>
      <p class="text-sm mb-2"><.link navigate={~p"/child/#{@child.id}"} class="underline">← {@child.name}</.link></p>
      <h1 class="text-2xl font-semibold mb-6">À introduire — {@child.name}</h1>

      <section class="mb-8">
        <h2 class="text-lg font-semibold mb-3">
          Adapté à l'âge actuel
          <span :if={@age_months} class="text-sm font-normal text-zinc-500">
            ({@age_months} mois)
          </span>
        </h2>
        <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <li :for={f <- @age_appropriate} class="rounded border border-zinc-200 px-3 py-2 text-sm">
            <div class="font-medium">{f.name}</div>
            <div class="text-xs text-zinc-500">
              {Categories.label(f.category)} · dès {f.suggested_age_months} mois
              <span :if={f.allergen_type}> · allergène&nbsp;{f.allergen_type}</span>
            </div>
          </li>
        </ul>
        <p :if={@age_appropriate == []} class="text-sm text-zinc-500">
          Tout a déjà été introduit !
        </p>
      </section>

      <section :if={@later != []}>
        <h2 class="text-lg font-semibold mb-3">À introduire plus tard</h2>
        <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <li :for={f <- @later} class="rounded border border-zinc-200 px-3 py-2 text-sm opacity-70">
            <div class="font-medium">{f.name}</div>
            <div class="text-xs text-zinc-500">
              {Categories.label(f.category)} · dès {f.suggested_age_months} mois
            </div>
          </li>
        </ul>
      </section>
    </Layouts.app>
    """
  end
end
