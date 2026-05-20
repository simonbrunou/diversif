defmodule Diversif.Idempotency.Key do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User

  @primary_key {:key, :string, autogenerate: false}
  schema "idempotency_keys" do
    field :scope, :string
    field :redirect, :string
    field :created_at, :utc_datetime_usec
    belongs_to :user, User
  end

  def changeset(idem, attrs) do
    idem
    |> cast(attrs, [:key, :user_id, :scope, :redirect, :created_at])
    |> validate_required([:key, :user_id, :scope, :created_at])
    |> foreign_key_constraint(:user_id)
  end
end
