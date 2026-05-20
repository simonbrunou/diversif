defmodule Diversif.SessionsBroadcastTest do
  use Diversif.DataCase, async: true

  alias Diversif.Accounts
  alias DiversifWeb.Endpoint

  defp register_user do
    {:ok, user} =
      Accounts.register_user(%{
        "email" => "sb#{System.unique_integer([:positive])}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "SB"
      })

    user
  end

  test "delete_all_user_sessions/1 broadcasts disconnect to every session topic" do
    user = register_user()
    s1 = Accounts.create_session(user.id)
    s2 = Accounts.create_session(user.id)

    Endpoint.subscribe("users_sessions:#{s1.id}")
    Endpoint.subscribe("users_sessions:#{s2.id}")

    Accounts.delete_all_user_sessions(user.id)

    # Both targeted devices must receive the disconnect — otherwise their
    # LV socket keeps a stale-token connection alive until the next HTTP
    # roundtrip validates the now-missing session.
    assert_receive %Phoenix.Socket.Broadcast{
      topic: "users_sessions:" <> id1,
      event: "disconnect"
    }

    assert_receive %Phoenix.Socket.Broadcast{
      topic: "users_sessions:" <> id2,
      event: "disconnect"
    }

    assert MapSet.new([id1, id2]) == MapSet.new([s1.id, s2.id])
  end
end
