defmodule DiversifWeb.SessionController do
  use DiversifWeb, :controller

  alias Diversif.{Accounts, Audit}
  alias DiversifWeb.UserAuth

  def create(conn, %{"session" => %{"email" => email, "password" => password}}) do
    ip = client_ip(conn)

    case Accounts.get_user_by_email_and_password(email, password) do
      nil ->
        Audit.record("login.failed", %{email: String.downcase(email || "")}, ip: ip)

        conn
        |> put_flash(:error, "Adresse e-mail ou mot de passe incorrect.")
        |> redirect(to: ~p"/login")

      user ->
        Audit.record("login.success", %{}, ip: ip, user_id: user.id)
        UserAuth.log_in_user(conn, user)
    end
  end

  def delete(conn, _params) do
    if user = conn.assigns[:current_user] do
      Audit.record("logout", %{}, ip: client_ip(conn), user_id: user.id)
    end

    conn
    |> put_flash(:info, "Vous êtes déconnecté.")
    |> UserAuth.log_out_user()
  end

  defp client_ip(conn) do
    case get_req_header(conn, "x-forwarded-for") do
      [val | _] -> val |> String.split(",") |> List.first() |> String.trim()
      _ -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end
end
