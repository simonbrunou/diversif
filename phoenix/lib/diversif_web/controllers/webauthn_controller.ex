defmodule DiversifWeb.WebauthnController do
  @moduledoc """
  JSON endpoints that drive the @simplewebauthn/browser client. Replaces the
  SvelteKit routes under `src/routes/api/webauthn/*`.
  """

  use DiversifWeb, :controller

  alias Diversif.{Accounts, Webauthn}
  alias DiversifWeb.UserAuth

  @challenge_cookie "wa_challenge"
  @challenge_max_age 5 * 60

  # ---------------------------------------------------------------------------
  # Registration (requires authenticated user)
  # ---------------------------------------------------------------------------

  def registration_options(conn, _params) do
    user = conn.assigns.current_user
    {:ok, %{options: options, challenge_token: token}} =
      Webauthn.build_registration_options(user)

    conn
    |> put_challenge_cookie(token)
    |> json(options)
  end

  def registration_verify(conn, params) do
    user = conn.assigns.current_user
    token = conn.cookies[@challenge_cookie] || ""
    name = params["name"] || "Passkey"
    response = params["response"] || params

    conn = clear_challenge_cookie(conn)

    case Webauthn.finish_registration(user, response, token, name: name) do
      {:ok, passkey} ->
        json(conn, %{ok: true, passkey: Webauthn.public_passkey(passkey)})

      {:error, :credential_already_registered} ->
        conn
        |> put_status(:conflict)
        |> json(%{ok: false, error: "Cette clé est déjà enregistrée."})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{ok: false, error: format_error(reason)})
    end
  end

  # ---------------------------------------------------------------------------
  # Authentication (guest)
  # ---------------------------------------------------------------------------

  def authentication_options(conn, _params) do
    {:ok, %{options: options, challenge_token: token}} =
      Webauthn.build_authentication_options()

    conn
    |> put_challenge_cookie(token)
    |> json(options)
  end

  def authentication_verify(conn, params) do
    token = conn.cookies[@challenge_cookie] || ""
    response = params["response"] || params

    conn = clear_challenge_cookie(conn)

    case Webauthn.finish_authentication(response, token) do
      {:ok, %{user_id: user_id}} ->
        case Accounts.get_user(user_id) do
          %{} = user ->
            UserAuth.log_in_user(conn, user)

          _ ->
            conn
            |> put_status(:unauthorized)
            |> json(%{ok: false, error: "Échec de l'authentification."})
        end

      {:error, msg} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{ok: false, error: msg})
    end
  end

  # ---------------------------------------------------------------------------
  # Passkey management (account page)
  # ---------------------------------------------------------------------------

  def list_passkeys(conn, _params) do
    user = conn.assigns.current_user
    keys = user.id |> Webauthn.list_passkeys() |> Enum.map(&Webauthn.public_passkey/1)
    json(conn, %{passkeys: keys})
  end

  def rename_passkey(conn, %{"id" => id, "name" => name}) do
    user = conn.assigns.current_user

    if Webauthn.rename_passkey(user.id, id, name) do
      json(conn, %{ok: true})
    else
      conn |> put_status(:not_found) |> json(%{ok: false})
    end
  end

  def delete_passkey(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    if Webauthn.delete_passkey(user.id, id) do
      json(conn, %{ok: true})
    else
      conn |> put_status(:not_found) |> json(%{ok: false})
    end
  end

  # ---------------------------------------------------------------------------
  # Cookie helpers
  # ---------------------------------------------------------------------------

  defp put_challenge_cookie(conn, token) do
    put_resp_cookie(conn, @challenge_cookie, token,
      sign: false,
      encrypt: false,
      same_site: "Lax",
      http_only: true,
      secure: conn.scheme == :https,
      max_age: @challenge_max_age
    )
  end

  defp clear_challenge_cookie(conn) do
    delete_resp_cookie(conn, @challenge_cookie, same_site: "Lax")
  end

  defp format_error(msg) when is_binary(msg), do: msg
  defp format_error(atom) when is_atom(atom), do: Atom.to_string(atom)
  defp format_error(_), do: "Verification failed"
end
