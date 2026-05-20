defmodule Diversif.Accounts.Session do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User

  @primary_key {:id, :string, autogenerate: false}
  schema "sessions" do
    field :expires_at, :utc_datetime_usec
    belongs_to :user, User
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:id, :user_id, :expires_at])
    |> validate_required([:id, :user_id, :expires_at])
    |> foreign_key_constraint(:user_id)
  end
end
