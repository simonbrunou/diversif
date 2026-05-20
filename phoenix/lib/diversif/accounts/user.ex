defmodule Diversif.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.{Passkey, Session}

  @derive {Inspect, except: [:password, :password_hash]}
  schema "users" do
    field :email, :string
    field :password_hash, :string
    field :display_name, :string

    # Virtual: plain password coming in from forms; never persisted.
    field :password, :string, virtual: true, redact: true

    field :created_at, :utc_datetime_usec
    field :tos_accepted_at, :utc_datetime_usec
    field :privacy_accepted_at, :utc_datetime_usec
    field :age_confirmed_at, :utc_datetime_usec
    field :last_login_at, :utc_datetime_usec
    field :last_export_at, :utc_datetime_usec

    has_many :sessions, Session
    has_many :passkeys, Passkey
  end

  @email_regex ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [
      :email,
      :password,
      :display_name,
      :tos_accepted_at,
      :privacy_accepted_at,
      :age_confirmed_at
    ])
    |> validate_required([:email, :password, :display_name])
    |> validate_format(:email, @email_regex)
    |> validate_length(:email, max: 254)
    |> validate_length(:password, min: 12, max: 256)
    |> validate_length(:display_name, min: 1, max: 80)
    |> update_change(:email, &String.downcase/1)
    |> unique_constraint(:email)
    |> hash_password()
    |> put_change(:created_at, DateTime.utc_now())
  end

  def password_changeset(user, attrs) do
    user
    |> cast(attrs, [:password])
    |> validate_required([:password])
    |> validate_length(:password, min: 12, max: 256)
    |> hash_password()
  end

  def profile_changeset(user, attrs) do
    user
    |> cast(attrs, [:display_name])
    |> validate_required([:display_name])
    |> validate_length(:display_name, min: 1, max: 80)
  end

  defp hash_password(%Ecto.Changeset{valid?: true, changes: %{password: pwd}} = cs) do
    cs
    |> put_change(:password_hash, Argon2.hash_pwd_salt(pwd))
    |> delete_change(:password)
  end

  defp hash_password(cs), do: cs
end
