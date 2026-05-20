defmodule DiversifWeb.RegistrationController do
  use DiversifWeb, :controller

  alias Diversif.{Accounts, Audit}
  alias DiversifWeb.UserAuth

  def create(conn, %{"user" => params}) do
    now = DateTime.utc_now()
    ip = client_ip(conn)

    attrs =
      params
      |> Map.put("tos_accepted_at", if(params["tos"] == "true", do: now))
      |> Map.put("privacy_accepted_at", if(params["privacy"] == "true", do: now))
      |> Map.put("age_confirmed_at", if(params["age"] == "true", do: now))

    case Accounts.register_user(attrs) do
      {:ok, user} ->
        Audit.record("signup.success", %{}, ip: ip, user_id: user.id)

        conn
        |> put_flash(:info, "Bienvenue !")
        |> UserAuth.log_in_user(user)

      {:error, _changeset} ->
        Audit.record("signup.failed", %{email: params["email"] || ""}, ip: ip)

        conn
        |> put_flash(:error, "Inscription impossible. Vérifiez vos informations.")
        |> redirect(to: ~p"/signup")
    end
  end

  defp client_ip(conn) do
    case get_req_header(conn, "x-forwarded-for") do
      [val | _] -> val |> String.split(",") |> List.first() |> String.trim()
      _ -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end
end
