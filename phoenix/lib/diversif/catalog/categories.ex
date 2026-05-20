defmodule Diversif.Catalog.Categories do
  @moduledoc """
  Food categories. Mirrors `src/lib/utils/categories.ts`.
  """

  @categories [
    {"legumes", "Légumes"},
    {"fruits", "Fruits"},
    {"feculents", "Féculents"},
    {"legumineuses", "Légumineuses"},
    {"viandes", "Viandes"},
    {"poissons", "Poissons"},
    {"oeufs", "Œufs"},
    {"produits_laitiers", "Produits laitiers"},
    {"allergenes", "Allergènes"},
    {"matieres_grasses", "Matières grasses"},
    {"aromates", "Aromates"},
    {"autre", "Autre"}
  ]

  def all, do: @categories
  def ids, do: Enum.map(@categories, &elem(&1, 0))

  def label(id) do
    case List.keyfind(@categories, id, 0) do
      {_, label} -> label
      nil -> id
    end
  end

  def options_for_select, do: Enum.map(@categories, fn {id, label} -> {label, id} end)
end
