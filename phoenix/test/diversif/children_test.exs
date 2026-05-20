defmodule Diversif.ChildrenTest do
  use Diversif.DataCase, async: true

  alias Diversif.{Accounts, Children}
  alias Diversif.Children.Membership

  defp register_user(suffix) do
    {:ok, user} =
      Accounts.register_user(%{
        "email" => "ch#{System.unique_integer([:positive])}#{suffix}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "Ch"
      })

    user
  end

  describe "accept_invitation/2" do
    test "joins the user and consumes the invite exactly once" do
      owner = register_user("owner")
      joiner = register_user("joiner")
      {:ok, child} = Children.create_child_with_owner(owner.id, %{"name" => "Bebe", "birth_date" => "2025-01-01"})
      {:ok, code} = Children.create_invitation(child.id, owner.id)

      inv = Children.find_invitation(code)
      assert inv

      assert {:ok, {:joined, joined_child}} = Children.accept_invitation(inv, joiner.id)
      assert joined_child.id == child.id

      # Membership exists.
      assert %Membership{role: "member"} = Children.get_membership(joiner.id, child.id)

      # Invitation is now nil-find (used).
      assert nil == Children.find_invitation(code)
    end

    test "already-member acceptance is a no-op (doesn't consume the invite)" do
      owner = register_user("owner2")
      {:ok, child} = Children.create_child_with_owner(owner.id, %{"name" => "Bebe", "birth_date" => "2025-01-01"})
      {:ok, code} = Children.create_invitation(child.id, owner.id)

      inv = Children.find_invitation(code)

      # The owner accepting their own invite is the "already_member" path.
      assert {:ok, {:already_member, _}} = Children.accept_invitation(inv, owner.id)

      # Invite is still alive for someone else.
      assert Children.find_invitation(code)
    end

    test "race-lost returns {:error, :race_lost} instead of MatchError" do
      owner = register_user("owner3")
      attacker = register_user("attacker")
      joiner = register_user("joiner3")
      {:ok, child} = Children.create_child_with_owner(owner.id, %{"name" => "Bebe", "birth_date" => "2025-01-01"})
      {:ok, code} = Children.create_invitation(child.id, owner.id)

      inv = Children.find_invitation(code)

      # Simulate the race: attacker uses the invite first.
      assert {:ok, {:joined, _}} = Children.accept_invitation(inv, attacker.id)

      # `inv` is stale but joiner's call to accept_invitation lands AFTER the
      # attacker's UPDATE. The function must return :race_lost, not crash.
      assert {:error, :race_lost} = Children.accept_invitation(inv, joiner.id)

      # Joiner did NOT get added.
      assert nil == Children.get_membership(joiner.id, child.id)
    end
  end

  describe "create_invitation/2 happy path" do
    test "generates a fresh BEBE-XXXXXX code on first attempt" do
      owner = register_user("owner4")

      {:ok, child} =
        Children.create_child_with_owner(owner.id, %{
          "name" => "Bebe",
          "birth_date" => "2025-01-01"
        })

      assert {:ok, code} = Children.create_invitation(child.id, owner.id)
      assert String.starts_with?(code, "BEBE-")
      assert Children.find_invitation(code)
    end
  end
end
