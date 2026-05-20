defmodule Diversif.WebauthnTest do
  use Diversif.DataCase, async: false

  alias Diversif.Webauthn

  describe "consume_challenge/2" do
    test "single-use: second consume of the same token returns :error" do
      challenge = Wax.new_authentication_challenge()
      bytes_b64 = Base.encode64(challenge.bytes)
      {token, _} = create_via_internal!("authentication", nil, bytes_b64)

      assert {:ok, %{bytes: bytes}} = Webauthn.consume_challenge(token, "authentication")
      assert byte_size(bytes) == 32
      assert :error == Webauthn.consume_challenge(token, "authentication")
    end

    test "wrong purpose returns :error AND deletes the row (no probing)" do
      challenge = Wax.new_registration_challenge()
      {token, _} = create_via_internal!("registration", nil, Base.encode64(challenge.bytes))

      assert :error == Webauthn.consume_challenge(token, "authentication")
      # Row was deleted regardless — second call with the right purpose
      # finds nothing, mirroring the SvelteKit single-use guarantee.
      assert :error == Webauthn.consume_challenge(token, "registration")
    end

    test "nil / empty / bogus token returns :error" do
      assert :error == Webauthn.consume_challenge("", "authentication")
      assert :error == Webauthn.consume_challenge(nil, "authentication")
      assert :error == Webauthn.consume_challenge("deadbeef", "authentication")
    end
  end

  describe "build_*_options/0/1" do
    test "registration options carry the same challenge bytes the verify path expects" do
      user = register_user()
      {:ok, %{options: opts, challenge_token: token}} = Webauthn.build_registration_options(user)

      assert is_binary(opts["challenge"])
      # 32 raw bytes → 43-char base64url, no padding.
      assert byte_size(opts["challenge"]) == 43

      # The consumed challenge round-trips byte-for-byte to the bytes the
      # browser receives — this is the invariant Wax.register depends on.
      {:ok, base} = Base.url_decode64(opts["challenge"], padding: false)
      assert {:ok, %{bytes: ^base}} = Webauthn.consume_challenge(token, "registration")
    end

    test "authentication options use discoverable-credential flow (no allowCredentials)" do
      {:ok, %{options: opts}} = Webauthn.build_authentication_options()
      assert opts["allowCredentials"] == []
      assert is_binary(opts["challenge"])
    end
  end

  describe "consume_challenge/2 atomicity under concurrency" do
    test "20 concurrent consumes of the same token: exactly one succeeds" do
      # SQL sandbox in shared mode so the spawned Tasks see the same row.
      Ecto.Adapters.SQL.Sandbox.mode(Diversif.Repo, {:shared, self()})

      {:ok, %{challenge_token: token}} = Webauthn.build_authentication_options()

      results =
        1..20
        |> Task.async_stream(
          fn _ -> Webauthn.consume_challenge(token, "authentication") end,
          max_concurrency: 20,
          ordered: false
        )
        |> Enum.map(fn {:ok, r} -> r end)

      ok_count = Enum.count(results, &match?({:ok, _}, &1))
      error_count = Enum.count(results, &(&1 == :error))

      assert ok_count == 1, "exactly one task must walk away with the challenge"
      assert error_count == 19
    end
  end

  # Helper: register a user without going through Accounts.register_user/1
  # so we don't drag in the timing-decoy delay.
  defp register_user do
    {:ok, user} =
      Diversif.Accounts.register_user(%{
        "email" => "wa#{System.unique_integer([:positive])}@diversif.test",
        "password" => "correcthorsebatterystaple",
        "display_name" => "WA"
      })

    user
  end

  # We can't call the private create_challenge! from outside the module, but
  # build_*_options is the only public way to put a row in the table — both
  # tests above use it. This helper just wraps it for clarity in the
  # single-use tests where we don't care which purpose was used.
  defp create_via_internal!("registration", _user_id, _bytes_b64) do
    user = register_user()
    {:ok, %{challenge_token: t}} = Webauthn.build_registration_options(user)
    {t, nil}
  end

  defp create_via_internal!("authentication", _user_id, _bytes_b64) do
    {:ok, %{challenge_token: t}} = Webauthn.build_authentication_options()
    {t, nil}
  end
end
