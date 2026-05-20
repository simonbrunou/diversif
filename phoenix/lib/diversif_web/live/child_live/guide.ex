defmodule DiversifWeb.ChildLive.Guide do
  use DiversifWeb, :live_view

  alias Diversif.Children

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} <- Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      months = age_months(child.birth_date)

      {:ok,
       socket
       |> assign(:page_title, "Guide — #{child.name}")
       |> assign(:child, child)
       |> assign(:age_months, months)
       |> assign(:stage, stage_for(months))
       |> assign(:default_texture, default_texture(months))}
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

  defp stage_for(nil), do: "—"
  defp stage_for(m) when m < 4, do: "Lait exclusif (avant 4 mois)"
  defp stage_for(m) when m < 6, do: "Démarrage de la diversification (4–6 mois)"
  defp stage_for(m) when m < 9, do: "Élargissement (6–9 mois)"
  defp stage_for(m) when m < 12, do: "Morceaux (9–12 mois)"
  defp stage_for(_), do: "Repas variés (12 mois et +)"

  defp default_texture(nil), do: "lisse"
  defp default_texture(m) when m < 6, do: "lisse"
  defp default_texture(m) when m < 7, do: "moulinée"
  defp default_texture(m) when m < 9, do: "écrasée"
  defp default_texture(m) when m < 12, do: "petits morceaux"
  defp default_texture(_), do: "morceaux"

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/child/#{@child.id}"} class="underline">← {@child.name}</.link></p>
      <h1 class="text-2xl font-semibold mb-2">Guide pour {@child.name}</h1>
      <p class="text-sm text-zinc-500 mb-6">
        Âge estimé&nbsp;: {if @age_months, do: "#{@age_months} mois", else: "—"}
      </p>

      <section class="rounded border border-zinc-200 p-4 mb-6">
        <h2 class="text-lg font-semibold">Étape</h2>
        <p class="mt-1">{@stage}</p>
      </section>

      <section class="rounded border border-zinc-200 p-4 mb-6">
        <h2 class="text-lg font-semibold">Texture conseillée</h2>
        <p class="mt-1 capitalize">{@default_texture}</p>
      </section>

      <p class="text-sm">
        <.link navigate={~p"/child/#{@child.id}/suggestions"} class="underline">
          Voir les aliments à introduire ensuite
        </.link>
      </p>
    </Layouts.app>
    """
  end
end
