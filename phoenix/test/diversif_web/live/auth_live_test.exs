defmodule DiversifWeb.AuthLiveTest do
  use DiversifWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  alias Diversif.Accounts

  describe "login page" do
    test "renders the form for guests", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/login")
      assert html =~ "Se connecter"
      assert html =~ "Adresse e-mail"
      # HEEx escapes apostrophes in attributes/text — match on the escaped
      # form so the assertion isn't tied to escape-character choices.
      assert html =~ ~r/clé d.{1,6}acc&#39;?è?s|clé d&#39;accès/
    end

    test "redirects authenticated users to home", %{conn: conn} do
      {:ok, user} =
        Accounts.register_user(%{
          "email" => "redir@diversif.test",
          "password" => "correcthorsebatterystaple",
          "display_name" => "Redir"
        })

      session = Accounts.create_session(user.id)

      conn =
        conn
        |> Plug.Test.init_test_session(%{user_token: session.id})

      assert {:error, {:redirect, %{to: "/"}}} = live(conn, ~p"/login")
    end
  end

  describe "signup page" do
    test "renders for guests", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/signup")
      assert html =~ "Créer un compte"
      assert html =~ "Prénom"
      assert html =~ ~r/conditions d.{1,6}utilisation|conditions d&#39;utilisation/
    end
  end

  describe "public legal pages" do
    test "/cgu renders without auth", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/cgu")
      # HTML-escapes apostrophes; matching the escaped variant is the safest.
      assert html =~ ~r/Conditions d.{1,6}utilisation|Conditions d&#39;utilisation/
    end

    test "/guide renders without auth", %{conn: conn} do
      {:ok, _view, html} = live(conn, ~p"/guide")
      assert html =~ "Guide de diversification"
    end
  end

  describe "home page auth gate" do
    test "guest is redirected to login", %{conn: conn} do
      assert {:error, {:redirect, %{to: "/login"}}} = live(conn, ~p"/")
    end

    test "authenticated user sees their child list", %{conn: conn} do
      {:ok, user} =
        Accounts.register_user(%{
          "email" => "home@diversif.test",
          "password" => "correcthorsebatterystaple",
          "display_name" => "Home"
        })

      session = Accounts.create_session(user.id)

      conn = Plug.Test.init_test_session(conn, %{user_token: session.id})

      {:ok, _view, html} = live(conn, ~p"/")
      assert html =~ "Mes enfants"
      assert html =~ "Aucun enfant"
    end
  end
end
