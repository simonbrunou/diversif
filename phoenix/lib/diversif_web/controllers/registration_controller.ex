defmodule DiversifWeb.RegistrationController do
  use DiversifWeb, :controller

  alias Diversif.Accounts
  alias DiversifWeb.UserAuth

  def create(conn, %{"user" => params}) do
    now = DateTime.utc_now()

    attrs =
      params
      |> Map.put("tos_accepted_at", if(params["tos"] == "true", do: now))
      |> Map.put("privacy_accepted_at", if(params["privacy"] == "true", do: now))
      |> Map.put("age_confirmed_at", if(params["age"] == "true", do: now))

    case Accounts.register_user(attrs) do
      {:ok, user} ->
        conn
        |> put_flash(:info, "Bienvenue !")
        |> UserAuth.log_in_user(user)

      {:error, _changeset} ->
        conn
        |> put_flash(:error, "Inscription impossible. Vérifiez vos informations.")
        |> redirect(to: ~p"/signup")
    end
  end
end
