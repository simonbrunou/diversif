defmodule Diversif.Accounts.WebauthnChallenge do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User

  @purposes ~w(registration authentication)

  @primary_key {:token, :string, autogenerate: false}
  schema "webauthn_challenges" do
    field :challenge, :string
    field :purpose, :string
    field :expires_at, :utc_datetime_usec
    belongs_to :user, User
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, [:token, :challenge, :purpose, :user_id, :expires_at])
    |> validate_required([:token, :challenge, :purpose, :expires_at])
    |> validate_inclusion(:purpose, @purposes)
    |> foreign_key_constraint(:user_id)
  end
end
