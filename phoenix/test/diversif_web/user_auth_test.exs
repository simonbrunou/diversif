defmodule DiversifWeb.UserAuthTest do
  use DiversifWeb.ConnCase, async: true

  alias Diversif.Accounts
  alias DiversifWeb.UserAuth

  setup %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{
        "email" => "ua#{System.unique_integer([:positive])}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "UA"
      })

    {:ok, user: user, conn: Plug.Test.init_test_session(conn, %{})}
  end

  describe "fetch_current_user/2" do
    test "no token → assigns nil and doesn't churn the session", %{conn: conn} do
      conn = UserAuth.fetch_current_user(conn, [])
      assert conn.assigns.current_user == nil
      assert Plug.Conn.get_session(conn, :user_token) == nil
    end

    test "valid token → assigns the user, leaves session intact", %{conn: conn, user: user} do
      session = Accounts.create_session(user.id)

      conn =
        conn
        |> Plug.Conn.put_session(:user_token, session.id)
        |> UserAuth.fetch_current_user([])

      assert conn.assigns.current_user.id == user.id
      assert Plug.Conn.get_session(conn, :user_token) == session.id
    end

    test "stale token (deleted server-side) → assigns nil AND clears the session",
         %{conn: conn, user: user} do
      session = Accounts.create_session(user.id)
      Accounts.delete_session(session.id)

      conn =
        conn
        |> Plug.Conn.put_session(:user_token, session.id)
        |> UserAuth.fetch_current_user([])

      assert conn.assigns.current_user == nil
      # The whole point of round 3 fix #1: scrub the dead token so future
      # requests don't keep re-validating it.
      assert Plug.Conn.get_session(conn, :user_token) == nil
    end

    test "expired token → assigns nil AND clears the session", %{conn: conn, user: user} do
      session = Accounts.create_session(user.id)

      # Force expiry without going through public API.
      import Ecto.Query
      alias Diversif.Accounts.Session
      alias Diversif.Repo

      Repo.update_all(
        from(s in Session, where: s.id == ^session.id),
        set: [expires_at: DateTime.add(DateTime.utc_now(), -3600, :second)]
      )

      conn =
        conn
        |> Plug.Conn.put_session(:user_token, session.id)
        |> UserAuth.fetch_current_user([])

      assert conn.assigns.current_user == nil
      assert Plug.Conn.get_session(conn, :user_token) == nil
    end
  end
end
