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
end
