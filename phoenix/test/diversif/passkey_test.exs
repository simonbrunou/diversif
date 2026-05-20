defmodule Diversif.PasskeyTest do
  use Diversif.DataCase, async: true

  alias Diversif.Accounts.Passkey
  alias Diversif.Repo

  defp register_user do
    {:ok, user} =
      Diversif.Accounts.register_user(%{
        "email" => "pk#{System.unique_integer([:positive])}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "PK"
      })

    user
  end

  defp passkey_attrs(user, overrides) do
    Map.merge(
      %{
        "id" => "cred-#{System.unique_integer([:positive])}",
        "user_id" => user.id,
        "public_key" => "QQ==",
        "device_type" => "multiDevice",
        "backed_up" => true,
        "name" => "Test key",
        "created_at" => DateTime.utc_now()
      },
      overrides
    )
  end

  test "duplicate credential id surfaces as a changeset error (not a raised ConstraintError)" do
    user = register_user()
    attrs = passkey_attrs(user, %{})

    assert {:ok, _} = %Passkey{} |> Passkey.changeset(attrs) |> Repo.insert()

    # Same id, same user. Without unique_constraint(:id) on the changeset
    # the second insert would raise Ecto.ConstraintError; with it, we get
    # an :id error key that Webauthn.finish_registration maps to
    # :credential_already_registered.
    assert {:error, %Ecto.Changeset{errors: errors}} =
             %Passkey{} |> Passkey.changeset(attrs) |> Repo.insert()

    assert Keyword.has_key?(errors, :id)
  end

  describe "cross-user authorization (IDOR defense)" do
    test "user B cannot rename user A's passkey" do
      alice = register_user()
      bob = register_user()

      {:ok, alice_key} =
        %Passkey{}
        |> Passkey.changeset(passkey_attrs(alice, %{"name" => "Alice's MacBook"}))
        |> Repo.insert()

      # Bob attempts to rename Alice's key by id. The user_id filter on
      # `rename_passkey/3` must return false — same row stays put.
      refute Diversif.Webauthn.rename_passkey(bob.id, alice_key.id, "Pwned")

      reloaded = Repo.get!(Passkey, alice_key.id)
      assert reloaded.name == "Alice's MacBook"
    end

    test "user B cannot delete user A's passkey" do
      alice = register_user()
      bob = register_user()

      {:ok, alice_key} =
        %Passkey{}
        |> Passkey.changeset(passkey_attrs(alice, %{}))
        |> Repo.insert()

      refute Diversif.Webauthn.delete_passkey(bob.id, alice_key.id)

      assert Repo.get(Passkey, alice_key.id)
    end

    test "user A CAN rename and delete their own passkey" do
      alice = register_user()

      {:ok, key} =
        %Passkey{}
        |> Passkey.changeset(passkey_attrs(alice, %{"name" => "Old name"}))
        |> Repo.insert()

      assert Diversif.Webauthn.rename_passkey(alice.id, key.id, "New name")
      assert Repo.get!(Passkey, key.id).name == "New name"

      assert Diversif.Webauthn.delete_passkey(alice.id, key.id)
      assert nil == Repo.get(Passkey, key.id)
    end

    test "rename_passkey rejects empty / whitespace-only name" do
      alice = register_user()

      {:ok, key} =
        %Passkey{}
        |> Passkey.changeset(passkey_attrs(alice, %{"name" => "Original"}))
        |> Repo.insert()

      refute Diversif.Webauthn.rename_passkey(alice.id, key.id, "")
      refute Diversif.Webauthn.rename_passkey(alice.id, key.id, "   ")
      assert Repo.get!(Passkey, key.id).name == "Original"
    end
  end
end
