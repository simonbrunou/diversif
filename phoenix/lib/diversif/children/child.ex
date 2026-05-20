defmodule Diversif.Children.Child do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User
  alias Diversif.Children.{Invitation, Membership}

  schema "children" do
    field :name, :string
    # Stored as text: dates straddle timezones inconsistently and the JS app
    # treats this as an ISO yyyy-MM-dd string, never a timestamp.
    field :birth_date, :string
    field :created_at, :utc_datetime_usec

    belongs_to :created_by_user, User, foreign_key: :created_by, references: :id

    has_many :memberships, Membership
    has_many :invitations, Invitation
  end

  def changeset(child, attrs) do
    child
    |> cast(attrs, [:name, :birth_date, :created_by, :created_at])
    |> validate_required([:name, :birth_date, :created_at])
    |> validate_length(:name, min: 1, max: 80)
    |> validate_format(:birth_date, ~r/^\d{4}-\d{2}-\d{2}$/)
    |> foreign_key_constraint(:created_by)
  end
end
