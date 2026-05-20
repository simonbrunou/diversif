defmodule DiversifWeb.AccountLive.Profile do
  use DiversifWeb, :live_view

  alias Diversif.Accounts.User
  alias Diversif.Repo

  @impl true
  def mount(_params, _session, socket) do
    cs = User.profile_changeset(socket.assigns.current_user, %{})

    {:ok,
     socket
     |> assign(:page_title, "Profil")
     |> assign(:form, to_form(cs, as: :user))}
  end

  @impl true
  def handle_event("save", %{"user" => params}, socket) do
    cs = User.profile_changeset(socket.assigns.current_user, params)

    case Repo.update(cs) do
      {:ok, user} ->
        {:noreply,
         socket
         |> assign(:current_user, user)
         |> assign(:form, to_form(User.profile_changeset(user, %{}), as: :user))
         |> put_flash(:info, "Profil enregistré.")}

      {:error, cs} ->
        {:noreply, assign(socket, :form, to_form(cs, as: :user))}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/account"} class="underline">← Mon compte</.link></p>
      <h1 class="text-2xl font-semibold mb-6">Profil</h1>
      <.form for={@form} phx-submit="save" class="space-y-4 max-w-sm">
        <.input field={@form[:display_name]} type="text" label="Prénom" required />
        <button type="submit" class="rounded bg-zinc-900 text-white px-4 py-2 font-medium">
          Enregistrer
        </button>
      </.form>
    </Layouts.app>
    """
  end
end
