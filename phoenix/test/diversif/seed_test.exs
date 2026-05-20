defmodule Diversif.SeedTest do
  use Diversif.DataCase, async: false

  alias Diversif.Logbook.Food
  alias Diversif.Repo

  # The DataCase sandbox is per-test, so we run the seed script inside the
  # test transaction. Running it twice asserts the partial unique
  # `foods_name_seed_idx` makes the seed safe to re-execute.
  test "seeds.exs is idempotent — re-running inserts zero rows" do
    Code.eval_file("priv/repo/seeds.exs")
    first_count = Repo.aggregate(Food, :count)
    assert first_count > 0

    Code.eval_file("priv/repo/seeds.exs")
    second_count = Repo.aggregate(Food, :count)
    assert second_count == first_count
  end

  test "custom food with the same name as a global one is allowed" do
    Code.eval_file("priv/repo/seeds.exs")
    [global | _] = Repo.all(Food)

    {:ok, owner} =
      Diversif.Accounts.register_user(%{
        "email" => "seed#{System.unique_integer([:positive])}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "Seed"
      })

    {:ok, child} =
      Diversif.Children.create_child_with_owner(owner.id, %{
        "name" => "Bebe",
        "birth_date" => "2025-01-01"
      })

    # The partial unique index has `WHERE is_custom = false`, so a custom
    # row with the same name slides past the conflict.
    assert {:ok, _} =
             Diversif.Logbook.create_custom_food(child.id, %{
               "name" => global.name,
               "category" => global.category
             })
  end
end
