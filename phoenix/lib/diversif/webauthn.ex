defmodule Diversif.Webauthn do
  @moduledoc """
  WebAuthn / passkey lifecycle. Crypto verification delegates to `wax_`.

  Wire format: same JSON shape that `@simplewebauthn/browser` uses (base64url
  for binary fields), so the browser-side glue in `assets/js/passkeys.js` is
  thin and the protocol stays compatible with anything that consumes the
  simplewebauthn JSON shape.

  Single-use challenge storage uses the `webauthn_challenges` table with an
  atomic `Repo.delete_all/2 ... select: c` (Postgres `DELETE … RETURNING`
  semantics) so two concurrent verifies of the same token can't both walk
  away with a valid challenge.
  """

  import Ecto.Query

  alias Diversif.Accounts.{Passkey, User, WebauthnChallenge}
  alias Diversif.Repo

  @challenge_ttl_seconds 5 * 60

  # ---------------------------------------------------------------------------
  # Public configuration
  # ---------------------------------------------------------------------------

  def rp_name, do: cfg(:rp_name) || "Diversif"
  def rp_id, do: cfg(:rp_id) || "localhost"
  def origin, do: cfg(:origin) || "http://localhost:4000"

  defp cfg(key), do: Application.get_env(:diversif, :webauthn, [])[key]

  # ---------------------------------------------------------------------------
  # Challenge storage (DB-backed, atomic single-use via DELETE…RETURNING)
  # ---------------------------------------------------------------------------

  def purge_expired_challenges(now \\ DateTime.utc_now()) do
    Repo.delete_all(from c in WebauthnChallenge, where: c.expires_at < ^now)
    :ok
  end

  defp create_challenge!(purpose, user_id, bytes_b64) do
    purge_expired_challenges()
    now = DateTime.utc_now()
    expires_at = DateTime.add(now, @challenge_ttl_seconds, :second)
    token = :crypto.strong_rand_bytes(32) |> Base.encode16(case: :lower)

    {:ok, _} =
      %WebauthnChallenge{}
      |> WebauthnChallenge.changeset(%{
        token: token,
        challenge: bytes_b64,
        purpose: purpose,
        user_id: user_id,
        expires_at: expires_at
      })
      |> Repo.insert()

    {token, expires_at}
  end

  @doc """
  Atomic single-use consume. Two racing verifies of the same token can't both
  walk away with a valid challenge — exactly one gets `{:ok, ...}`, the other
  gets `:error`. We DELETE on the bare token regardless of purpose/expiry, so
  hostile callers can't reflexively probe to see what purpose a token is
  bound to either.
  """
  def consume_challenge(token, purpose)
      when is_binary(token) and purpose in ["registration", "authentication"] do
    {_count, rows} =
      from(c in WebauthnChallenge, where: c.token == ^token, select: c)
      |> Repo.delete_all()

    case rows do
      [%WebauthnChallenge{purpose: ^purpose, expires_at: exp} = row] ->
        if DateTime.compare(exp, DateTime.utc_now()) == :gt do
          {:ok, %{bytes: Base.decode64!(row.challenge), user_id: row.user_id}}
        else
          :error
        end

      _ ->
        :error
    end
  end

  def consume_challenge(_, _), do: :error

  # ---------------------------------------------------------------------------
  # Registration
  # ---------------------------------------------------------------------------

  @doc """
  Builds simplewebauthn-compatible JSON for `startRegistration()`. Persists the
  challenge in the DB so verify can fetch it back atomically.
  """
  def build_registration_options(%User{} = user) do
    challenge = Wax.new_registration_challenge(attestation: "none")
    bytes_b64 = Base.encode64(challenge.bytes)
    {token, _expires_at} = create_challenge!("registration", user.id, bytes_b64)

    existing = list_passkeys(user.id)

    options = %{
      "rp" => %{"name" => rp_name(), "id" => rp_id()},
      "user" => %{
        "id" => to_string(user.id) |> Base.url_encode64(padding: false),
        "name" => user.email,
        "displayName" => user.display_name
      },
      "challenge" => Base.url_encode64(challenge.bytes, padding: false),
      "pubKeyCredParams" => [
        %{"type" => "public-key", "alg" => -7},
        %{"type" => "public-key", "alg" => -257}
      ],
      "timeout" => 60_000,
      "attestation" => "none",
      "excludeCredentials" =>
        Enum.map(existing, fn pk ->
          %{
            "type" => "public-key",
            "id" => pk.id,
            "transports" => pk.transports
          }
        end),
      "authenticatorSelection" => %{
        "residentKey" => "required",
        "requireResidentKey" => true,
        "userVerification" => "preferred"
      }
    }

    {:ok, %{options: options, challenge_token: token}}
  end

  @doc """
  Verifies a registration response. The browser sends a simplewebauthn
  `RegistrationResponseJSON`; we decode the inner attestationObject /
  clientDataJSON to raw bytes for `Wax.register/3`.
  """
  def finish_registration(%User{} = user, %{} = response, challenge_token, opts \\ []) do
    name = opts[:name] || "Passkey"

    with {:ok, %{bytes: challenge_bytes}} <- consume_challenge(challenge_token, "registration"),
         {:ok, attestation_object_cbor} <- decode_b64url(response, ["response", "attestationObject"]),
         {:ok, client_data_json} <- decode_b64url(response, ["response", "clientDataJSON"]),
         credential_id when is_binary(credential_id) <- response["id"],
         challenge_struct = build_challenge(:registration, challenge_bytes),
         {:ok, {auth_data, _attestation_result}} <-
           Wax.register(attestation_object_cbor, client_data_json, challenge_struct),
         nil <- find_passkey(credential_id) do
      acd = auth_data.attested_credential_data

      transports = get_in(response, ["response", "transports"]) || []
      flags = auth_data.flag

      device_type = if flags.backup_eligibility, do: "multiDevice", else: "singleDevice"
      backed_up = flags.backup_state

      attrs = %{
        "id" => credential_id,
        "user_id" => user.id,
        "public_key" => encode_cose_key(acd.credential_public_key),
        "counter" => auth_data.sign_count,
        "transports" => transports,
        "device_type" => device_type,
        "backed_up" => backed_up,
        "name" => name |> String.trim() |> String.slice(0, 80),
        "created_at" => DateTime.utc_now()
      }

      case %Passkey{} |> Passkey.changeset(attrs) |> Repo.insert() do
        {:ok, _} = ok -> ok
        # Unique-violation on the credential id => already registered. Surface
        # the dedicated reason so callers can render the right message.
        {:error, %Ecto.Changeset{errors: errors}} ->
          if Keyword.has_key?(errors, :id),
            do: {:error, :credential_already_registered},
            else: {:error, :persistence_failed}
      end
    else
      :error ->
        {:error, :invalid_challenge}

      %Passkey{} ->
        {:error, :credential_already_registered}

      {:error, %_{} = wax_err} ->
        {:error, Exception.message(wax_err)}

      {:error, reason} ->
        {:error, reason}

      _ ->
        {:error, :invalid_response}
    end
  end

  # ---------------------------------------------------------------------------
  # Authentication
  # ---------------------------------------------------------------------------

  @doc """
  Builds simplewebauthn-compatible JSON for `startAuthentication()`. No
  `allowCredentials` — discoverable-credential flow (matches the SvelteKit
  port's username-less login).
  """
  def build_authentication_options do
    challenge = Wax.new_authentication_challenge()
    bytes_b64 = Base.encode64(challenge.bytes)
    {token, _expires_at} = create_challenge!("authentication", nil, bytes_b64)

    options = %{
      "rpId" => rp_id(),
      "challenge" => Base.url_encode64(challenge.bytes, padding: false),
      "timeout" => 60_000,
      "userVerification" => "preferred",
      "allowCredentials" => []
    }

    {:ok, %{options: options, challenge_token: token}}
  end

  @generic_auth_error "Échec de l'authentification."

  def finish_authentication(%{} = response, challenge_token) do
    with credential_id when is_binary(credential_id) <- response["id"],
         {:ok, %{bytes: challenge_bytes}} <- consume_challenge(challenge_token, "authentication"),
         {:ok, auth_data_bin} <- decode_b64url(response, ["response", "authenticatorData"]),
         {:ok, signature} <- decode_b64url(response, ["response", "signature"]),
         {:ok, client_data_json} <- decode_b64url(response, ["response", "clientDataJSON"]),
         %Passkey{} = passkey <- find_passkey(credential_id) || run_timing_decoy(),
         cose_key = decode_cose_key(passkey.public_key),
         challenge_struct =
           build_challenge(:authentication, challenge_bytes, [{credential_id, cose_key}]),
         {:ok, auth_data} <-
           Wax.authenticate(
             credential_id,
             auth_data_bin,
             signature,
             client_data_json,
             challenge_struct,
             [{credential_id, cose_key}]
           ) do
      case passkey
           |> Ecto.Changeset.change(%{
             counter: auth_data.sign_count,
             backed_up: auth_data.flag.backup_state,
             last_used_at: DateTime.utc_now()
           })
           |> Repo.update() do
        {:ok, updated} ->
          {:ok, %{passkey: updated, user_id: passkey.user_id}}

        {:error, cs} ->
          # Persistence failure after a successful crypto verify is a server
          # problem, not an auth failure. Log and surface a distinct error so
          # the user retries instead of re-running the WebAuthn ceremony.
          require Logger

          Logger.error(
            "passkey.counter_update_failed: #{inspect(cs.errors)} credential=#{credential_id}"
          )

          {:error, :persistence_failed}
      end
    else
      :error -> {:error, @generic_auth_error}
      :no_credential -> {:error, @generic_auth_error}
      {:error, _} -> {:error, @generic_auth_error}
      _ -> {:error, @generic_auth_error}
    end
  end

  # Defends against credential-id enumeration via response timing. Burns the
  # CPU equivalent of a real ECDSA verify so "no such credential" can't be
  # told apart from "credential found, signature wrong" at the wall-clock
  # level. The returned :no_credential short-circuits the `with` and reaches
  # the generic-error branch (same message as a real-verify failure — content
  # parity matters as much as timing).
  defp run_timing_decoy do
    # Keep keygen + verify both inside the try — FIPS-restricted OTP builds
    # can raise from generate_key, not just from verify. Without this wrapper
    # the "no credential" path would 500 instead of returning a generic auth
    # error, re-opening the credential-id enumeration oracle the decoy is
    # designed to close. The Logger.warning makes the failure visible.
    try do
      {public_key, _private_key} = :crypto.generate_key(:ecdh, :secp256r1)
      sig = :crypto.strong_rand_bytes(64)

      :crypto.verify(:ecdsa, :sha256, :crypto.strong_rand_bytes(32), sig, [
        public_key,
        :secp256r1
      ])
    rescue
      e in [ArgumentError, ErlangError] ->
        require Logger
        Logger.warning("webauthn.timing_decoy_failed: #{Exception.message(e)}")
        :ok
    end

    :no_credential
  end

  # ---------------------------------------------------------------------------
  # Passkey CRUD
  # ---------------------------------------------------------------------------

  def list_passkeys(user_id) when is_integer(user_id) do
    Repo.all(from p in Passkey, where: p.user_id == ^user_id)
  end

  def find_passkey(credential_id) when is_binary(credential_id) do
    Repo.get(Passkey, credential_id)
  end

  def delete_passkey(user_id, credential_id) when is_integer(user_id) and is_binary(credential_id) do
    {count, _} =
      from(p in Passkey, where: p.id == ^credential_id and p.user_id == ^user_id)
      |> Repo.delete_all()

    count > 0
  end

  def rename_passkey(user_id, credential_id, name)
      when is_integer(user_id) and is_binary(credential_id) and is_binary(name) do
    trimmed = name |> String.trim() |> String.slice(0, 80)

    if trimmed == "" do
      false
    else
      {count, _} =
        from(p in Passkey, where: p.id == ^credential_id and p.user_id == ^user_id)
        |> Repo.update_all(set: [name: trimmed])

      count > 0
    end
  end

  def public_passkey(%Passkey{} = p) do
    %{
      "id" => p.id,
      "name" => p.name,
      "deviceType" => p.device_type,
      "backedUp" => p.backed_up,
      "createdAt" => DateTime.to_unix(p.created_at, :millisecond),
      "lastUsedAt" => p.last_used_at && DateTime.to_unix(p.last_used_at, :millisecond)
    }
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp build_challenge(:registration, bytes) do
    Wax.new_registration_challenge(bytes: bytes, attestation: "none")
  end

  defp build_challenge(:authentication, bytes, credentials \\ []) do
    Wax.new_authentication_challenge(bytes: bytes, allow_credentials: credentials)
  end

  defp decode_b64url(response, path) do
    case get_in(response, path) do
      v when is_binary(v) ->
        case Base.url_decode64(v, padding: false) do
          {:ok, _} = ok -> ok
          :error -> Base.url_decode64(v)
        end

      _ ->
        {:error, :missing_field}
    end
  end

  defp encode_cose_key(map) when is_map(map) do
    map |> :erlang.term_to_binary() |> Base.encode64()
  end

  defp decode_cose_key(b64) when is_binary(b64) do
    b64 |> Base.decode64!() |> :erlang.binary_to_term([:safe])
  end
end
