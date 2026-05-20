defmodule DiversifWeb.JoinLive do
  use DiversifWeb, :live_view

  alias Diversif.Children

  @impl true
  def mount(%{"code" => code}, _session, socket) do
    invitation = Children.find_invitation(code)
    child = invitation && Children.get_child(invitation.child_id)

    {:ok,
     socket
     |> assign(:page_title, "Rejoindre")
     |> assign(:code, code)
     |> assign(:invitation, invitation)
     |> assign(:child, child)}
  end

  @impl true
  def handle_event("accept", _, socket) do
    case socket.assigns do
      %{invitation: %{} = inv, current_user: %{id: user_id}} ->
        case Children.accept_invitation(inv, user_id) do
          {:ok, {:joined, child}} ->
            {:noreply,
             socket
             |> put_flash(:info, "Vous suivez maintenant #{child.name}.")
             |> push_navigate(to: ~p"/child/#{child.id}")}

          {:ok, {:already_member, child}} ->
            {:noreply,
             socket
             |> put_flash(:info, "Vous suivez déjà #{child.name}.")
             |> push_navigate(to: ~p"/child/#{child.id}")}

          {:error, :race_lost} ->
            {:noreply,
             put_flash(
               socket,
               :error,
               "Ce lien d'invitation vient d'être utilisé par quelqu'un d'autre."
             )}

          _ ->
            {:noreply, put_flash(socket, :error, "Invitation invalide.")}
        end

      _ ->
        {:noreply, push_navigate(socket, to: ~p"/login")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <h1 class="text-2xl font-semibold mb-6">Rejoindre un suivi</h1>

      <div :if={@invitation && @child} class="rounded border border-zinc-200 p-6">
        <p class="text-sm">Vous êtes invité(e) à rejoindre le suivi de</p>
        <p class="text-2xl font-semibold mt-2">{@child.name}</p>

        <%= if @current_user do %>
          <p class="mt-4 text-sm text-zinc-600">
            En tant que <span class="font-medium">{@current_user.display_name}</span>, vous pouvez
            accepter cette invitation maintenant.
          </p>
          <button
            phx-click="accept"
            class="mt-4 rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
          >
            Accepter l'invitation
          </button>
        <% else %>
          <p class="mt-4 text-sm text-zinc-600">
            Pour accepter, créez un compte ou connectez-vous, puis revenez sur ce lien.
          </p>
          <div class="mt-4 flex gap-2">
            <.link navigate={~p"/login"} class="rounded border border-zinc-300 px-3 py-2 text-sm">
              Se connecter
            </.link>
            <.link navigate={~p"/signup"} class="rounded bg-zinc-900 text-white px-3 py-2 text-sm">
              Créer un compte
            </.link>
          </div>
        <% end %>
      </div>

      <div :if={!@invitation} class="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
        Ce lien d'invitation n'est plus valide.
      </div>
    </Layouts.app>
    """
  end
end
