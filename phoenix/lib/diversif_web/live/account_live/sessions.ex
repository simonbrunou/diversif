defmodule DiversifWeb.AccountLive.Sessions do
  use DiversifWeb, :live_view

  import Ecto.Query

  alias Diversif.Accounts.Session
  alias Diversif.Repo

  @impl true
  def mount(_params, session, socket) do
    current_token = session["user_token"]

    {:ok,
     socket
     |> assign(:page_title, "Sessions")
     |> assign(:current_token, current_token)
     |> assign(:sessions, list_sessions(socket.assigns.current_user.id))}
  end

  @impl true
  def handle_event("revoke", %{"id" => token}, socket) do
    user_id = socket.assigns.current_user.id

    Repo.delete_all(from s in Session, where: s.id == ^token and s.user_id == ^user_id)

    {:noreply,
     socket
     |> assign(:sessions, list_sessions(user_id))
     |> put_flash(:info, "Session révoquée.")}
  end

  defp list_sessions(user_id) do
    Repo.all(from s in Session, where: s.user_id == ^user_id, order_by: [desc: s.expires_at])
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/account"} class="underline">← Mon compte</.link></p>
      <h1 class="text-2xl font-semibold mb-6">Sessions actives</h1>

      <ul class="space-y-2">
        <li :for={s <- @sessions} class="rounded border border-zinc-200 px-4 py-3 text-sm flex items-center justify-between">
          <div>
            <div class="font-mono text-xs text-zinc-500">{String.slice(s.id, 0, 12)}…</div>
            <div class="text-xs text-zinc-500">
              Expire le {Calendar.strftime(s.expires_at, "%d/%m/%Y %H:%M")}
              <span :if={s.id == @current_token} class="ml-2 text-emerald-700">(cet appareil)</span>
            </div>
          </div>
          <button
            :if={s.id != @current_token}
            phx-click="revoke"
            phx-value-id={s.id}
            data-confirm="Révoquer cette session ?"
            class="text-rose-600 underline text-xs"
          >
            Révoquer
          </button>
        </li>
      </ul>
    </Layouts.app>
    """
  end
end
