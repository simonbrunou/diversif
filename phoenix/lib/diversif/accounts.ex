defmodule Diversif.Accounts do
  @moduledoc """
  Auth & user management — port of `src/lib/server/auth.ts`.
  """

  import Ecto.Query

  alias Diversif.Accounts.{Session, User}
  alias Diversif.Children.Membership
  alias Diversif.Repo

  @session_duration_seconds 60 * 60 * 24 * 30
  @session_renew_threshold_seconds 60 * 60 * 24 * 15

  def session_duration_seconds, do: @session_duration_seconds

  # ---------------------------------------------------------------------------
  # Registration / lookup
  # ---------------------------------------------------------------------------

  def register_user(attrs) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  def change_user_registration(attrs \\ %{}) do
    User.registration_changeset(%User{}, attrs)
  end

  def get_user(id), do: Repo.get(User, id)

  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: String.downcase(email))
  end

  @doc """
  Verify email+password. Burns equivalent CPU against a decoy hash when the
  user does not exist so wall-clock time cannot be used to enumerate accounts.
  """
  def get_user_by_email_and_password(email, password)
      when is_binary(email) and is_binary(password) do
    user = get_user_by_email(email)

    cond do
      user && Argon2.verify_pass(password, user.password_hash) ->
        :telemetry.execute([:diversif, :accounts, :login, :success], %{}, %{})
        user

      true ->
        # Constant-time path when user missing OR password wrong. Argon2
        # ships a `no_user_verify` helper that performs a dummy hash exactly
        # like a real verify, so wall-clock time matches the truthy branch.
        :telemetry.execute([:diversif, :accounts, :login, :decoy_verify], %{}, %{
          user_existed: user != nil
        })

        Argon2.no_user_verify()
        nil
    end
  end

  # ---------------------------------------------------------------------------
  # Sessions
  # ---------------------------------------------------------------------------

  def create_session(user_id) when is_integer(user_id) do
    now = DateTime.utc_now()
    token = generate_token()
    expires_at = DateTime.add(now, @session_duration_seconds, :second)

    {:ok, session} =
      %Session{}
      |> Session.changeset(%{id: token, user_id: user_id, expires_at: expires_at})
      |> Repo.insert()

    session
  end

  @doc """
  Look up a session by token. If valid and within the renew threshold, extends
  the expiry and bumps `users.last_login_at` in a single transaction.

  Return shapes (distinct so callers can scrub stale tokens from cookies):

    * `{:ok, %{user: %User{}, session: %Session{}, renewed: boolean}}` — valid
    * `:expired` — token exists in DB but is past `expires_at`
    * `nil` — token unknown, deleted, or malformed
  """
  def validate_session(token) when is_binary(token) and byte_size(token) > 0 do
    now = DateTime.utc_now()

    row =
      Repo.one(
        from s in Session,
          join: u in assoc(s, :user),
          where: s.id == ^token,
          select: {s, u},
          limit: 1
      )

    cond do
      is_nil(row) ->
        nil

      elem(row, 0).expires_at |> DateTime.compare(now) != :gt ->
        :expired

      true ->
        validate_session_renew(row, now)
    end
  end

  def validate_session(_), do: nil

  defp validate_session_renew({session, user}, now) do
    remaining = DateTime.diff(session.expires_at, now, :second)

    if remaining < @session_renew_threshold_seconds do
      new_expiry = DateTime.add(now, @session_duration_seconds, :second)
      token = session.id

      {:ok, %{session: renewed_session}} =
        Repo.transaction(fn ->
          {1, _} =
            from(s in Session, where: s.id == ^token)
            |> Repo.update_all(set: [expires_at: new_expiry])

          {1, _} =
            from(u in User, where: u.id == ^user.id)
            |> Repo.update_all(set: [last_login_at: now])

          %{session: %{session | expires_at: new_expiry}}
        end)

      {:ok, %{user: %{user | last_login_at: now}, session: renewed_session, renewed: true}}
    else
      {:ok, %{user: user, session: session, renewed: false}}
    end
  end

  def delete_session(token) when is_binary(token) and byte_size(token) > 0 do
    Repo.delete_all(from s in Session, where: s.id == ^token)
    :ok
  end

  def delete_session(_), do: :ok

  def delete_all_user_sessions(user_id) when is_integer(user_id) do
    tokens =
      Repo.all(from s in Session, where: s.user_id == ^user_id, select: s.id)

    Repo.delete_all(from s in Session, where: s.user_id == ^user_id)

    # Kick every live socket bound to one of those tokens — otherwise the user's
    # other tabs keep their LV connection open until the next HTTP roundtrip
    # validates the now-missing session.
    Enum.each(tokens, fn t ->
      DiversifWeb.Endpoint.broadcast("users_sessions:#{t}", "disconnect", %{})
    end)

    :ok
  end

  # ---------------------------------------------------------------------------
  # Memberships (cached on conn for guard checks; matches SvelteKit locals)
  # ---------------------------------------------------------------------------

  def list_memberships_for_user(user_id) when is_integer(user_id) do
    Repo.all(from m in Membership, where: m.user_id == ^user_id)
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp generate_token do
    :crypto.strong_rand_bytes(32) |> Base.encode16(case: :lower)
  end
end
