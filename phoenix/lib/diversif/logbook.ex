defmodule Diversif.Logbook do
  @moduledoc """
  Logbook context: foods catalog, food entries, symptoms, tip dismissals.
  Port of the various `src/lib/server/...` modules and route handlers.
  """

  import Ecto.Query

  alias Diversif.Logbook.{Food, FoodEntry, Symptom, TipDismissal}
  alias Diversif.Repo

  # ---------------------------------------------------------------------------
  # Foods (catalog visible to a given child = global rows + custom rows)
  # ---------------------------------------------------------------------------

  def list_foods_for_child(child_id) when is_integer(child_id) do
    Repo.all(
      from f in Food,
        where: is_nil(f.custom_for_child_id) or f.custom_for_child_id == ^child_id,
        order_by: [asc: f.name]
    )
  end

  def get_food(id) when is_integer(id), do: Repo.get(Food, id)

  def create_custom_food(child_id, attrs) when is_integer(child_id) do
    attrs =
      attrs
      |> Map.put("is_custom", true)
      |> Map.put("custom_for_child_id", child_id)
      |> Map.put_new("is_major_allergen", false)
      |> Map.put_new("suggested_age_months", 0)

    %Food{}
    |> Food.changeset(attrs)
    |> Repo.insert()
  end

  # ---------------------------------------------------------------------------
  # Food entries
  # ---------------------------------------------------------------------------

  def list_entries_for_child(child_id) when is_integer(child_id) do
    Repo.all(
      from e in FoodEntry,
        where: e.child_id == ^child_id,
        order_by: [desc: e.given_at],
        preload: [:food]
    )
  end

  def get_entry(id) when is_integer(id) do
    Repo.one(from e in FoodEntry, where: e.id == ^id, preload: [:food, :symptoms])
  end

  def create_entry(attrs) do
    attrs = Map.put_new(attrs, "created_at", DateTime.utc_now())

    %FoodEntry{}
    |> FoodEntry.changeset(attrs)
    |> Repo.insert()
  end

  def delete_entry(%FoodEntry{} = entry), do: Repo.delete(entry)

  def change_entry(attrs \\ %{}), do: FoodEntry.changeset(%FoodEntry{}, attrs)

  # ---------------------------------------------------------------------------
  # Diversity / counts (cheap stats for the dashboard)
  # ---------------------------------------------------------------------------

  def stats_for_child(child_id) when is_integer(child_id) do
    %{
      entry_count: Repo.one(from e in FoodEntry, where: e.child_id == ^child_id, select: count()),
      distinct_foods:
        Repo.one(
          from e in FoodEntry,
            where: e.child_id == ^child_id,
            select: count(e.food_id, :distinct)
        ),
      distinct_categories:
        Repo.one(
          from e in FoodEntry,
            join: f in assoc(e, :food),
            where: e.child_id == ^child_id and f.category != "autre",
            select: count(f.category, :distinct)
        ),
      distinct_allergens:
        Repo.one(
          from e in FoodEntry,
            join: f in assoc(e, :food),
            where: e.child_id == ^child_id and not is_nil(f.allergen_type),
            select: count(f.allergen_type, :distinct)
        )
    }
  end

  @doc """
  Per-allergen introduction map. Returns a list of
  `%{allergen: id, first_at: DateTime.t() | nil, count: integer}` keyed in the
  Allergens.all/0 order so the UI can iterate predictably.
  """
  def allergen_status_for_child(child_id) when is_integer(child_id) do
    rows =
      Repo.all(
        from e in FoodEntry,
          join: f in assoc(e, :food),
          where: e.child_id == ^child_id and not is_nil(f.allergen_type),
          group_by: f.allergen_type,
          select: {f.allergen_type, min(e.given_at), count(e.id)}
      )
      |> Map.new(fn {a, first, n} -> {a, %{first_at: first, count: n}} end)

    Enum.map(Diversif.Catalog.Allergens.all(), fn {id, label} ->
      data = Map.get(rows, id, %{first_at: nil, count: 0})
      Map.merge(data, %{allergen: id, label: label})
    end)
  end

  @doc """
  Reaction-report data: every entry that has either a non-"ras" reaction or
  one+ associated symptom. Suitable for the printable medical report.
  """
  def reaction_report_for_child(child_id) when is_integer(child_id) do
    entries =
      Repo.all(
        from e in FoodEntry,
          where: e.child_id == ^child_id and e.reaction != "ras",
          order_by: [desc: e.given_at],
          preload: [:food, :symptoms]
      )

    with_symptoms =
      Repo.all(
        from e in FoodEntry,
          join: s in Symptom,
          on: s.food_entry_id == e.id,
          where: e.child_id == ^child_id and e.reaction == "ras",
          distinct: e.id,
          order_by: [desc: e.given_at],
          preload: [:food, :symptoms]
      )

    (entries ++ with_symptoms)
    |> Enum.uniq_by(& &1.id)
    |> Enum.sort_by(& &1.given_at, {:desc, DateTime})
  end

  @doc """
  Foods not yet introduced for a child, ordered by suggested_age_months
  (so the "next thing to try" shows first). Excludes custom foods.
  """
  def suggestions_for_child(child_id) when is_integer(child_id) do
    eaten_food_ids =
      from(e in FoodEntry, where: e.child_id == ^child_id, select: e.food_id, distinct: true)

    Repo.all(
      from f in Food,
        where: f.is_custom == false and f.id not in subquery(eaten_food_ids),
        order_by: [asc: f.suggested_age_months, asc: f.name]
    )
  end

  def update_entry(%FoodEntry{} = entry, attrs) do
    entry |> FoodEntry.changeset(attrs) |> Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Symptoms
  # ---------------------------------------------------------------------------

  def list_symptoms_for_entry(entry_id) when is_integer(entry_id) do
    Repo.all(from s in Symptom, where: s.food_entry_id == ^entry_id, order_by: [asc: s.observed_at])
  end

  def create_symptom(attrs) do
    attrs = Map.put_new(attrs, "created_at", DateTime.utc_now())

    %Symptom{}
    |> Symptom.changeset(attrs)
    |> Repo.insert()
  end

  def delete_symptom(%Symptom{} = sym), do: Repo.delete(sym)

  def change_symptom(attrs \\ %{}), do: Symptom.changeset(%Symptom{}, attrs)

  # ---------------------------------------------------------------------------
  # Tip dismissals
  # ---------------------------------------------------------------------------

  def dismiss_tip(user_id, child_id, reminder_key)
      when is_integer(user_id) and is_integer(child_id) and is_binary(reminder_key) do
    attrs = %{
      "user_id" => user_id,
      "child_id" => child_id,
      "reminder_key" => reminder_key,
      "dismissed_at" => DateTime.utc_now()
    }

    %TipDismissal{}
    |> TipDismissal.changeset(attrs)
    |> Repo.insert(
      on_conflict: [set: [dismissed_at: attrs["dismissed_at"]]],
      conflict_target: [:user_id, :child_id, :reminder_key]
    )
  end

  def list_dismissals(user_id, child_id) do
    Repo.all(
      from d in TipDismissal,
        where: d.user_id == ^user_id and d.child_id == ^child_id
    )
  end
end
