defmodule DiversifWeb.SessionController do
  use DiversifWeb, :controller

  alias Diversif.Accounts
  alias DiversifWeb.UserAuth

  def create(conn, %{"session" => %{"email" => email, "password" => password}}) do
    case Accounts.get_user_by_email_and_password(email, password) do
      nil ->
        conn
        |> put_flash(:error, "Adresse e-mail ou mot de passe incorrect.")
        |> redirect(to: ~p"/login")

      user ->
        UserAuth.log_in_user(conn, user)
    end
  end

  def delete(conn, _params) do
    conn
    |> put_flash(:info, "Vous êtes déconnecté.")
    |> UserAuth.log_out_user()
  end
end
