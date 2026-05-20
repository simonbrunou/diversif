defmodule Diversif.Logbook.Food do
  use Ecto.Schema
  import Ecto.Changeset

  alias Diversif.Children.Child

  schema "foods" do
    field :name, :string
    field :category, :string
    field :is_major_allergen, :boolean, default: false
    field :allergen_type, :string
    field :suggested_age_months, :integer
    field :notes, :string
    field :is_custom, :boolean, default: false

    belongs_to :custom_for_child, Child
  end

  def changeset(food, attrs) do
    food
    |> cast(attrs, [
      :name,
      :category,
      :is_major_allergen,
      :allergen_type,
      :suggested_age_months,
      :notes,
      :is_custom,
      :custom_for_child_id
    ])
    |> validate_required([:name, :category, :suggested_age_months])
    |> validate_length(:name, min: 1, max: 120)
    |> validate_number(:suggested_age_months, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:custom_for_child_id)
    |> unique_constraint(:name, name: :foods_name_seed_idx)
  end
end
