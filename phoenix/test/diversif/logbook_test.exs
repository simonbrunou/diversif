defmodule Diversif.LogbookTest do
  use Diversif.DataCase, async: true

  alias Diversif.{Accounts, Children, Logbook}
  alias Diversif.Logbook.Food
  alias Diversif.Repo

  defp setup_child do
    {:ok, user} =
      Accounts.register_user(%{
        "email" => "lb#{System.unique_integer([:positive])}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "LB"
      })

    {:ok, child} =
      Children.create_child_with_owner(user.id, %{
        "name" => "Bebe",
        "birth_date" => "2025-01-01"
      })

    {user, child}
  end

  defp insert_food!(attrs) do
    Repo.insert!(
      Food.changeset(%Food{}, Map.merge(%{"name" => "T#{System.unique_integer([:positive])}", "category" => "fruits", "suggested_age_months" => 6}, attrs))
    )
  end

  describe "list_foods_for_child/1 scoping" do
    test "custom food for child A is invisible to child B" do
      {_, child_a} = setup_child()
      {_, child_b} = setup_child()

      {:ok, _custom} =
        Logbook.create_custom_food(child_a.id, %{"name" => "Carotte bio (A)", "category" => "legumes"})

      a_names = Logbook.list_foods_for_child(child_a.id) |> Enum.map(& &1.name)
      b_names = Logbook.list_foods_for_child(child_b.id) |> Enum.map(& &1.name)

      assert "Carotte bio (A)" in a_names
      refute "Carotte bio (A)" in b_names
    end
  end

  describe "suggestions_for_child/1 includes own customs" do
    test "child's own custom foods are suggested if not yet eaten" do
      {_, child} = setup_child()

      {:ok, custom} =
        Logbook.create_custom_food(child.id, %{"name" => "Carotte bio (own)", "category" => "legumes"})

      suggestions = Logbook.suggestions_for_child(child.id) |> Enum.map(& &1.id)

      assert custom.id in suggestions
    end

    test "other children's customs are NOT suggested" do
      {_, child_a} = setup_child()
      {_, child_b} = setup_child()

      {:ok, custom} =
        Logbook.create_custom_food(child_a.id, %{"name" => "Foreign", "category" => "legumes"})

      suggestions = Logbook.suggestions_for_child(child_b.id) |> Enum.map(& &1.id)
      refute custom.id in suggestions
    end
  end

  describe "Symptom.changeset default created_at" do
    test "omitting the key defaults to now()" do
      attrs = %{
        "food_entry_id" => 1,
        "child_id" => 1,
        "observed_at" => DateTime.utc_now(),
        "label" => "rougeur"
      }

      cs = Diversif.Logbook.Symptom.changeset(%Diversif.Logbook.Symptom{}, attrs)
      assert cs.valid?
      assert %DateTime{} = Ecto.Changeset.get_field(cs, :created_at)
    end

    test "passing explicit nil for created_at fails validate_required (no silent default)" do
      attrs = %{
        "food_entry_id" => 1,
        "child_id" => 1,
        "observed_at" => DateTime.utc_now(),
        "label" => "rougeur",
        "created_at" => nil
      }

      cs = Diversif.Logbook.Symptom.changeset(%Diversif.Logbook.Symptom{}, attrs)
      refute cs.valid?
      assert {"can't be blank", _} = cs.errors[:created_at]
    end
  end

  describe "stats_for_child/1" do
    test "returns zeroed map for a child with no entries" do
      {_, child} = setup_child()

      assert %{entry_count: 0, distinct_foods: 0, distinct_categories: 0, distinct_allergens: 0} =
               Logbook.stats_for_child(child.id)
    end

    test "counts distinct categories excluding 'autre'" do
      {user, child} = setup_child()
      f1 = insert_food!(%{"category" => "legumes", "name" => "F1"})
      f2 = insert_food!(%{"category" => "autre", "name" => "F2"})

      {:ok, _} =
        Logbook.create_entry(%{
          "child_id" => child.id,
          "food_id" => f1.id,
          "given_at" => DateTime.utc_now(),
          "reaction" => "ras",
          "logged_by" => user.id
        })

      {:ok, _} =
        Logbook.create_entry(%{
          "child_id" => child.id,
          "food_id" => f2.id,
          "given_at" => DateTime.utc_now(),
          "reaction" => "ras",
          "logged_by" => user.id
        })

      stats = Logbook.stats_for_child(child.id)
      assert stats.entry_count == 2
      # 'autre' is not counted as a category — only the 'legumes' entry counts.
      assert stats.distinct_categories == 1
    end
  end
end
