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
    # Default created_at to now ONLY when the caller omits the key entirely.
    # `cast` doesn't record a `nil` change for utc_datetime_usec when the
    # caller passes the key with a nil value, so checking the changeset
    # after cast can't distinguish "absent" from "explicit nil". We have
    # to inspect attrs directly *before* cast.
    attrs = default_created_at(attrs)

    symptom
    |> cast(attrs, [:food_entry_id, :child_id, :observed_at, :label, :note, :created_by, :created_at])
    |> validate_required([:food_entry_id, :child_id, :observed_at, :label, :created_at])
    |> validate_inclusion(:label, @labels)
    |> foreign_key_constraint(:food_entry_id)
    |> foreign_key_constraint(:child_id)
    |> foreign_key_constraint(:created_by)
  end

  defp default_created_at(%{} = attrs) do
    cond do
      Map.has_key?(attrs, "created_at") -> attrs
      Map.has_key?(attrs, :created_at) -> attrs
      # Match the caller's key style — Ecto's cast raises on mixed string +
      # atom keys, so we infer from whatever else is in the map.
      atom_keyed?(attrs) -> Map.put(attrs, :created_at, DateTime.utc_now())
      true -> Map.put(attrs, "created_at", DateTime.utc_now())
    end
  end

  defp default_created_at(attrs), do: attrs

  defp atom_keyed?(attrs) when attrs == %{}, do: true

  defp atom_keyed?(attrs) do
    Enum.all?(Map.keys(attrs), &is_atom/1)
  end
end
