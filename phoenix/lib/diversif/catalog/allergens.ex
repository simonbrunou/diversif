defmodule Diversif.Catalog.Allergens do
  @moduledoc """
  The 12 allergens diversif tracks. Mirrors `src/lib/utils/allergens.ts`.
  """

  @allergens [
    {"gluten", "Gluten"},
    {"oeuf", "Œuf"},
    {"lait", "Lait"},
    {"arachide", "Arachide"},
    {"fruits_a_coque", "Fruits à coque"},
    {"sesame", "Sésame"},
    {"soja", "Soja"},
    {"poisson", "Poisson"},
    {"crustace", "Crustacés"},
    {"mollusque", "Mollusques"},
    {"celeri", "Céleri"},
    {"moutarde", "Moutarde"}
  ]

  def all, do: @allergens
  def ids, do: Enum.map(@allergens, &elem(&1, 0))
  def total, do: length(@allergens)

  def label(id) do
    case List.keyfind(@allergens, id, 0) do
      {_, label} -> label
      nil -> id
    end
  end

  # LEAP/EAT/ESPGHAN-supported early introduction subset (mirrors PRIORITY_INTRODUCTION_ALLERGENS).
  def priority_introduction, do: ~w(oeuf arachide lait gluten fruits_a_coque sesame poisson)
end
