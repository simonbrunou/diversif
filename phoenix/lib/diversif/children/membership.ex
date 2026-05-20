defmodule Diversif.Children.Membership do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User
  alias Diversif.Children.Child

  @roles ~w(owner member)

  @primary_key false
  schema "memberships" do
    field :role, :string
    field :created_at, :utc_datetime_usec

    belongs_to :user, User, primary_key: true
    belongs_to :child, Child, primary_key: true
  end

  def changeset(membership, attrs) do
    membership
    |> cast(attrs, [:user_id, :child_id, :role, :created_at])
    |> validate_required([:user_id, :child_id, :role, :created_at])
    |> validate_inclusion(:role, @roles)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:child_id)
  end
end
