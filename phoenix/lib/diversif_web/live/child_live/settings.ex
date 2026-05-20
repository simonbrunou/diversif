defmodule DiversifWeb.ChildLive.Settings do
  use DiversifWeb, :live_view

  alias Diversif.Children

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{} = membership <-
           Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      {:ok,
       socket
       |> assign(:page_title, "Paramètres — #{child.name}")
       |> assign(:child, child)
       |> assign(:role, membership.role)
       |> assign(:form, to_form(Children.change_child(Map.from_struct(child)), as: :child))}
    else
      _ -> {:ok, socket |> put_flash(:error, "Enfant introuvable.") |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def handle_event("save", %{"child" => params}, socket) do
    case Children.update_child(socket.assigns.child, params) do
      {:ok, child} ->
        {:noreply,
         socket
         |> assign(:child, child)
         |> put_flash(:info, "Paramètres enregistrés.")}

      {:error, cs} ->
        {:noreply, assign(socket, :form, to_form(cs, as: :child))}
    end
  end

  def handle_event("delete", _, socket) do
    if socket.assigns.role != "owner" do
      {:noreply, put_flash(socket, :error, "Action réservée au créateur.")}
    else
      case Children.delete_child(socket.assigns.child) do
        {:ok, _} ->
          {:noreply,
           socket
           |> put_flash(:info, "Enfant supprimé.")
           |> push_navigate(to: ~p"/")}

        _ ->
          {:noreply, put_flash(socket, :error, "Suppression impossible.")}
      end
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2">
        <.link navigate={~p"/child/#{@child.id}"} class="underline">← {@child.name}</.link>
      </p>
      <h1 class="text-2xl font-semibold mb-6">Paramètres</h1>

      <.form for={@form} phx-submit="save" class="space-y-4">
        <.input field={@form[:name]} type="text" label="Prénom" required />
        <.input field={@form[:birth_date]} type="date" label="Date de naissance" required />
        <button type="submit" class="rounded bg-zinc-900 text-white px-4 py-2 font-medium">
          Enregistrer
        </button>
      </.form>

      <hr class="my-8 border-zinc-200" />

      <section :if={@role == "owner"}>
        <h2 class="text-lg font-semibold mb-2">Zone dangereuse</h2>
        <p class="text-sm text-zinc-600 mb-3">
          Supprimer un enfant efface ses repas, symptômes et invitations.
        </p>
        <button
          phx-click="delete"
          data-confirm={"Supprimer définitivement #{@child.name} ?"}
          class="rounded border border-rose-600 text-rose-600 px-3 py-2 text-sm"
        >
          Supprimer cet enfant
        </button>
      </section>
    </Layouts.app>
    """
  end
end
