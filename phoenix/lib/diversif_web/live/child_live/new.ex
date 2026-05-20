defmodule DiversifWeb.ChildLive.New do
  use DiversifWeb, :live_view

  alias Diversif.Children

  @impl true
  def mount(_params, _session, socket) do
    changeset = Children.change_child(%{})

    {:ok,
     socket
     |> assign(:page_title, "Nouvel enfant")
     |> assign(:form, to_form(changeset, as: :child))}
  end

  @impl true
  def handle_event("validate", %{"child" => params}, socket) do
    changeset =
      Children.change_child(params)
      |> Map.put(:action, :validate)

    {:noreply, assign(socket, :form, to_form(changeset, as: :child))}
  end

  def handle_event("save", %{"child" => params}, socket) do
    case Children.create_child_with_owner(socket.assigns.current_user.id, params) do
      {:ok, child} ->
        {:noreply,
         socket
         |> put_flash(:info, "#{child.name} ajouté(e).")
         |> push_navigate(to: ~p"/child/#{child.id}")}

      {:error, changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset, as: :child))}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <h1 class="text-2xl font-semibold mb-6">Nouvel enfant</h1>

      <.form for={@form} phx-change="validate" phx-submit="save" class="space-y-4">
        <.input field={@form[:name]} type="text" label="Prénom" required />
        <.input field={@form[:birth_date]} type="date" label="Date de naissance" required />
        <button type="submit" class="rounded bg-zinc-900 text-white px-4 py-2 font-medium">
          Créer
        </button>
      </.form>

      <p class="mt-6 text-sm text-zinc-500">
        <.link navigate={~p"/"} class="underline">Retour</.link>
      </p>
    </Layouts.app>
    """
  end
end
