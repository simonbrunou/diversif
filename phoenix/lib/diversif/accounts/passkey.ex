defmodule Diversif.Accounts.Passkey do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User

  @device_types ~w(singleDevice multiDevice)

  @primary_key {:id, :string, autogenerate: false}
  schema "passkeys" do
    field :public_key, :string
    field :counter, :integer, default: 0
    field :transports, {:array, :string}, default: []
    field :device_type, :string
    field :backed_up, :boolean
    field :name, :string
    field :created_at, :utc_datetime_usec
    field :last_used_at, :utc_datetime_usec

    belongs_to :user, User
  end

  def changeset(passkey, attrs) do
    passkey
    |> cast(attrs, [
      :id,
      :user_id,
      :public_key,
      :counter,
      :transports,
      :device_type,
      :backed_up,
      :name,
      :created_at,
      :last_used_at
    ])
    |> validate_required([:id, :user_id, :public_key, :device_type, :backed_up, :name])
    |> validate_inclusion(:device_type, @device_types)
    |> validate_length(:name, min: 1, max: 80)
    |> foreign_key_constraint(:user_id)
    # The PK collision (re-registering a credential id we already store) must
    # come back as a changeset error so Webauthn.finish_registration can map
    # it to :credential_already_registered. Without this, Repo.insert raises
    # Ecto.ConstraintError and that dedicated path is unreachable.
    |> unique_constraint(:id, name: :passkeys_pkey)
  end
end
