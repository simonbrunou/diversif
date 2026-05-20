defmodule DiversifWeb.UserAuth do
  @moduledoc """
  Plugs + on_mount hooks for session-cookie-backed auth. Mirrors the SvelteKit
  hooks/guards in `src/hooks.server.ts` + `src/lib/server/guards.ts`.

  The session token is carried inside the encrypted Phoenix session cookie
  (`Plug.Session`), so both controllers and LiveViews read it the same way.
  """

  use DiversifWeb, :verified_routes

  import Plug.Conn
  import Phoenix.Controller

  alias Diversif.Accounts
  alias Phoenix.LiveView

  # ---------------------------------------------------------------------------
  # Controller helpers
  # ---------------------------------------------------------------------------

  def log_in_user(conn, %{id: user_id}, _params \\ %{}) do
    session = Accounts.create_session(user_id)
    return_to = get_session(conn, :user_return_to)

    conn
    |> renew_session()
    |> put_session(:user_token, session.id)
    |> put_session(:live_socket_id, "users_sessions:#{session.id}")
    |> redirect(to: return_to || ~p"/")
  end

  def log_out_user(conn) do
    token = get_session(conn, :user_token)

    if token do
      Accounts.delete_session(token)
      DiversifWeb.Endpoint.broadcast(socket_id(token), "disconnect", %{})
    end

    conn
    |> renew_session()
    |> redirect(to: ~p"/login")
  end

  # ---------------------------------------------------------------------------
  # Plugs
  # ---------------------------------------------------------------------------

  @doc """
  Loads `current_user` onto the conn from the session token, auto-renewing the
  session when within the renew threshold. Always assigns; sets nil if no
  valid session.
  """
  def fetch_current_user(conn, _opts) do
    token = get_session(conn, :user_token)

    case token && Accounts.validate_session(token) do
      {:ok, %{user: user}} ->
        assign(conn, :current_user, user)

      nil ->
        # No token: no-op assign (don't churn the session cookie).
        assign(conn, :current_user, nil)

      _stale ->
        # Token present but invalid (expired, revoked, deleted). Scrub it so
        # subsequent requests don't re-hit the DB with the same dead value.
        conn
        |> delete_session(:user_token)
        |> assign(:current_user, nil)
    end
  end

  def require_authenticated_user(conn, _opts) do
    if conn.assigns[:current_user] do
      conn
    else
      conn
      |> maybe_store_return_to()
      |> put_flash(:error, "Vous devez être connecté pour accéder à cette page.")
      |> redirect(to: ~p"/login")
      |> halt()
    end
  end

  def require_guest(conn, _opts) do
    if conn.assigns[:current_user] do
      conn |> redirect(to: ~p"/") |> halt()
    else
      conn
    end
  end

  # ---------------------------------------------------------------------------
  # LiveView on_mount hooks
  # ---------------------------------------------------------------------------

  def on_mount(:mount_current_user, _params, session, socket) do
    {:cont, mount_current_user(socket, session)}
  end

  def on_mount(:ensure_authenticated, _params, session, socket) do
    socket = mount_current_user(socket, session)

    if socket.assigns.current_user do
      {:cont, socket}
    else
      {:halt,
       socket
       |> LiveView.put_flash(:error, "Vous devez être connecté.")
       |> LiveView.redirect(to: ~p"/login")}
    end
  end

  def on_mount(:redirect_if_authenticated, _params, session, socket) do
    socket = mount_current_user(socket, session)

    if socket.assigns.current_user do
      {:halt, LiveView.redirect(socket, to: ~p"/")}
    else
      {:cont, socket}
    end
  end

  defp mount_current_user(socket, session) do
    Phoenix.Component.assign_new(socket, :current_user, fn ->
      with token when is_binary(token) <- Map.get(session, "user_token"),
           {:ok, %{user: user}} <- Accounts.validate_session(token) do
        user
      else
        _ -> nil
      end
    end)
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp renew_session(conn) do
    delete_csrf_token()

    conn
    |> configure_session(renew: true)
    |> clear_session()
  end

  defp socket_id(token), do: "users_sessions:#{token}"

  defp maybe_store_return_to(%{method: "GET"} = conn) do
    put_session(conn, :user_return_to, current_path(conn))
  end

  defp maybe_store_return_to(conn), do: conn
end
