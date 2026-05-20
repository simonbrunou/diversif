defmodule DiversifWeb.ChildLive.Invite do
  use DiversifWeb, :live_view

  alias Diversif.{Accounts, Children}

  @impl true
  def mount(%{"id" => id}, _session, socket) do
    with {child_id, ""} <- Integer.parse(id),
         %{role: "owner"} <-
           Children.get_membership(socket.assigns.current_user.id, child_id),
         %{} = child <- Children.get_child(child_id) do
      members =
        Children.list_memberships_for_child(child_id)
        |> Enum.map(fn m ->
          user = Accounts.get_user(m.user_id)
          %{role: m.role, name: user && user.display_name, email: user && user.email}
        end)

      {:ok,
       socket
       |> assign(:page_title, "Inviter — #{child.name}")
       |> assign(:child, child)
       |> assign(:members, members)
       |> assign(:invite_code, nil)}
    else
      _ ->
        {:ok,
         socket
         |> put_flash(:error, "Accès refusé.")
         |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def handle_event("create", _, socket) do
    case Children.create_invitation(socket.assigns.child.id, socket.assigns.current_user.id) do
      {:ok, code} -> {:noreply, assign(socket, :invite_code, code)}
      _ -> {:noreply, put_flash(socket, :error, "Création impossible.")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2">
        <.link navigate={~p"/child/#{@child.id}"} class="underline">← {@child.name}</.link>
      </p>
      <h1 class="text-2xl font-semibold mb-6">Inviter un coparent</h1>

      <button
        phx-click="create"
        class="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
      >
        Générer un code d'invitation
      </button>

      <div :if={@invite_code} class="mt-4 rounded border border-emerald-200 bg-emerald-50 p-4">
        <p class="text-sm">Partagez ce lien (valable 7 jours)&nbsp;:</p>
        <p class="mt-1 font-mono text-sm break-all">
          {~p"/join/#{@invite_code}"}
        </p>
        <p class="mt-1 font-mono text-sm text-zinc-500">Code : {@invite_code}</p>
      </div>

      <h2 class="text-lg font-semibold mt-8 mb-3">Membres</h2>
      <ul class="space-y-2">
        <li :for={m <- @members} class="rounded border border-zinc-200 px-3 py-2 text-sm">
          <div class="font-medium">{m.name}</div>
          <div class="text-xs text-zinc-500">{m.email} · {m.role}</div>
        </li>
      </ul>
    </Layouts.app>
    """
  end
end
