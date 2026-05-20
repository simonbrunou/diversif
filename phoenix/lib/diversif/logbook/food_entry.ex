defmodule Diversif.Logbook.FoodEntry do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User
  alias Diversif.Children.Child
  alias Diversif.Logbook.{Food, Symptom}

  @reactions ~w(ras inconfort reaction)
  @textures ~w(lisse moulinee ecrasee petits-morceaux morceaux finger)

  schema "food_entries" do
    field :given_at, :utc_datetime_usec
    field :reaction, :string
    field :texture, :string
    field :notes, :string
    field :created_at, :utc_datetime_usec

    belongs_to :child, Child
    belongs_to :food, Food
    belongs_to :logger, User, foreign_key: :logged_by, references: :id

    has_many :symptoms, Symptom
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :child_id,
      :food_id,
      :given_at,
      :reaction,
      :texture,
      :notes,
      :logged_by,
      :created_at
    ])
    |> validate_required([:child_id, :food_id, :given_at, :reaction, :created_at])
    |> validate_inclusion(:reaction, @reactions)
    |> validate_inclusion(:texture, @textures)
    |> foreign_key_constraint(:child_id)
    |> foreign_key_constraint(:food_id)
    |> foreign_key_constraint(:logged_by)
  end

  @doc """
  Sparse changeset for the Edit LiveView. Only mutates user-editable fields;
  intentionally skips `validate_required` on child_id/food_id/created_at so
  a partial form submit doesn't blank them.
  """
  def update_changeset(entry, attrs) do
    entry
    |> cast(attrs, [:given_at, :reaction, :texture, :notes])
    |> validate_required([:given_at, :reaction])
    |> validate_inclusion(:reaction, @reactions)
    |> validate_inclusion(:texture, @textures)
  end
end
