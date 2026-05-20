defmodule Diversif.Logbook.Symptom do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Accounts.User
  alias Diversif.Children.Child
  alias Diversif.Logbook.FoodEntry

  @labels ~w(
    rougeur urticaire eczema vomissement diarrhee gonflement toux
    detresse-respiratoire levres-bleues autre
  )

  schema "symptoms" do
    field :observed_at, :utc_datetime_usec
    field :label, :string
    field :note, :string
    field :created_at, :utc_datetime_usec

    belongs_to :food_entry, FoodEntry
    belongs_to :child, Child
    belongs_to :creator, User, foreign_key: :created_by, references: :id
  end

  def changeset(symptom, attrs) do
    symptom
    |> cast(attrs, [:food_entry_id, :child_id, :observed_at, :label, :note, :created_by, :created_at])
    |> put_change_if_missing(:created_at, DateTime.utc_now())
    |> validate_required([:food_entry_id, :child_id, :observed_at, :label, :created_at])
    |> validate_inclusion(:label, @labels)
    |> foreign_key_constraint(:food_entry_id)
    |> foreign_key_constraint(:child_id)
    |> foreign_key_constraint(:created_by)
  end

  defp put_change_if_missing(changeset, field, value) do
    case Ecto.Changeset.get_field(changeset, field) do
      nil -> Ecto.Changeset.put_change(changeset, field, value)
      _ -> changeset
    end
  end
end
