defmodule Diversif.AccountsTest do
  use Diversif.DataCase, async: true

  alias Diversif.Accounts
  alias Diversif.Accounts.{Session, User}
  alias Diversif.Repo

  defp register_user(overrides \\ %{}) do
    {:ok, user} =
      Accounts.register_user(
        Map.merge(
          %{
            "email" => "u#{System.unique_integer([:positive])}@diversif.test",
            "password" => "correcthorsebatterystaple",
            "display_name" => "Test"
          },
          overrides
        )
      )

    user
  end

  describe "get_user_by_email_and_password/2" do
    test "returns the user on correct credentials, case-insensitive email" do
      user = register_user(%{"email" => "case@diversif.test"})

      assert %User{id: id} =
               Accounts.get_user_by_email_and_password(
                 "CASE@diversif.test",
                 "correcthorsebatterystaple"
               )

      assert id == user.id
    end

    test "returns nil on wrong password" do
      register_user(%{"email" => "wrong@diversif.test"})

      assert nil ==
               Accounts.get_user_by_email_and_password("wrong@diversif.test", "notthepassword!!")
    end

    test "returns nil for unknown email (decoy verify keeps timing parity)" do
      assert nil ==
               Accounts.get_user_by_email_and_password(
                 "nobody@diversif.test",
                 "correcthorsebatterystaple"
               )
    end
  end

  describe "validate_session/1" do
    test "returns nil for nil / empty / non-binary token" do
      assert nil == Accounts.validate_session(nil)
      assert nil == Accounts.validate_session("")
      assert nil == Accounts.validate_session(:atom)
    end

    test "returns nil when token doesn't exist" do
      assert nil == Accounts.validate_session("deadbeef")
    end

    test "returns nil for expired session" do
      user = register_user()
      session = Accounts.create_session(user.id)

      Repo.update_all(
        from(s in Session, where: s.id == ^session.id),
        set: [expires_at: DateTime.add(DateTime.utc_now(), -3600, :second)]
      )

      assert nil == Accounts.validate_session(session.id)
    end

    test "validates within renew threshold but does NOT renew when fresh" do
      user = register_user()
      session = Accounts.create_session(user.id)
      original_expiry = session.expires_at

      assert {:ok, %{renewed: false, session: %{expires_at: ^original_expiry}}} =
               Accounts.validate_session(session.id)
    end

    test "renews + bumps last_login_at when within renew threshold" do
      user = register_user()
      session = Accounts.create_session(user.id)

      # Force the session into the renew window (< 15 days remaining).
      threshold_ish = DateTime.add(DateTime.utc_now(), 60 * 60 * 24, :second)

      Repo.update_all(
        from(s in Session, where: s.id == ^session.id),
        set: [expires_at: threshold_ish]
      )

      assert {:ok, %{renewed: true, session: renewed, user: returned_user}} =
               Accounts.validate_session(session.id)

      assert DateTime.compare(renewed.expires_at, threshold_ish) == :gt
      # last_login_at gets bumped in the same transaction.
      assert %DateTime{} = returned_user.last_login_at
    end
  end

  describe "delete_all_user_sessions/1" do
    test "removes every session for the user" do
      user = register_user()
      Accounts.create_session(user.id)
      Accounts.create_session(user.id)

      assert 2 == Repo.aggregate(from(s in Session, where: s.user_id == ^user.id), :count)

      Accounts.delete_all_user_sessions(user.id)

      assert 0 == Repo.aggregate(from(s in Session, where: s.user_id == ^user.id), :count)
    end
  end
end
