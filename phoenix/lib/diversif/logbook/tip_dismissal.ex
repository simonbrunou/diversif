defmodule Diversif.Logbook.TipDismissal do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User
  alias Diversif.Children.Child

  @primary_key false
  schema "tip_dismissals" do
    field :reminder_key, :string, primary_key: true
    field :dismissed_at, :utc_datetime_usec

    belongs_to :user, User, primary_key: true
    belongs_to :child, Child, primary_key: true
  end

  def changeset(dismissal, attrs) do
    dismissal
    |> cast(attrs, [:user_id, :child_id, :reminder_key, :dismissed_at])
    |> validate_required([:user_id, :child_id, :reminder_key, :dismissed_at])
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:child_id)
  end
end
