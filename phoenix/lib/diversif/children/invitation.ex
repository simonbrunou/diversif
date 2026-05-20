defmodule Diversif.Children.Invitation do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User
  alias Diversif.Children.Child

  @primary_key {:code, :string, autogenerate: false}
  schema "invitations" do
    field :created_at, :utc_datetime_usec
    field :expires_at, :utc_datetime_usec
    field :used_at, :utc_datetime_usec

    belongs_to :child, Child
    belongs_to :creator, User, foreign_key: :created_by, references: :id
    belongs_to :user_who_used, User, foreign_key: :used_by, references: :id
  end

  def changeset(invitation, attrs) do
    invitation
    |> cast(attrs, [:code, :child_id, :created_by, :created_at, :expires_at, :used_at, :used_by])
    |> validate_required([:code, :child_id, :created_at, :expires_at])
    |> foreign_key_constraint(:child_id)
    |> foreign_key_constraint(:created_by)
    |> foreign_key_constraint(:used_by)
  end
end
