defmodule DiversifWeb.RemoteIpTest do
  use ExUnit.Case, async: false

  import Plug.Test

  alias DiversifWeb.RemoteIp

  defp with_proxies(proxies, fun) do
    prev = Application.get_env(:diversif, :trusted_proxies, [])
    Application.put_env(:diversif, :trusted_proxies, proxies)
    try do
      fun.()
    after
      Application.put_env(:diversif, :trusted_proxies, prev)
    end
  end

  defp conn_with(opts) do
    conn = conn(:get, "/")
    conn = if opts[:remote_ip], do: %{conn | remote_ip: opts[:remote_ip]}, else: conn

    Enum.reduce(opts[:headers] || [], conn, fn {k, v}, acc ->
      Plug.Conn.put_req_header(acc, k, v)
    end)
  end

  describe "from_conn/1 with no trusted proxies configured" do
    test "ignores cf-connecting-ip / x-forwarded-for entirely (spoof defense)" do
      with_proxies([], fn ->
        conn =
          conn_with(
            remote_ip: {1, 2, 3, 4},
            headers: [{"cf-connecting-ip", "9.9.9.9"}, {"x-forwarded-for", "8.8.8.8"}]
          )

        assert "1.2.3.4" == RemoteIp.from_conn(conn)
      end)
    end

    test "returns remote_ip directly when no spoof headers are set" do
      with_proxies([], fn ->
        assert "10.0.0.1" == RemoteIp.from_conn(conn_with(remote_ip: {10, 0, 0, 1}))
      end)
    end

    test "returns 'unknown' for nil remote_ip (e.g. unix-socket request)" do
      with_proxies([], fn ->
        conn = conn_with([])
        nil_conn = %{conn | remote_ip: nil}
        assert "unknown" == RemoteIp.from_conn(nil_conn)
      end)
    end
  end

  describe "from_conn/1 with a trusted proxy" do
    test "honours cf-connecting-ip when the peer is in a configured CIDR" do
      with_proxies(["10.0.0.0/8"], fn ->
        conn =
          conn_with(
            remote_ip: {10, 1, 2, 3},
            headers: [{"cf-connecting-ip", "9.9.9.9"}]
          )

        assert "9.9.9.9" == RemoteIp.from_conn(conn)
      end)
    end

    test "falls back to first X-Forwarded-For hop if cf-connecting-ip is absent" do
      with_proxies(["10.0.0.0/8"], fn ->
        conn =
          conn_with(
            remote_ip: {10, 1, 2, 3},
            headers: [{"x-forwarded-for", "9.9.9.9, 8.8.8.8"}]
          )

        assert "9.9.9.9" == RemoteIp.from_conn(conn)
      end)
    end

    test "ignores cf-connecting-ip when peer is outside the trusted CIDR" do
      with_proxies(["10.0.0.0/8"], fn ->
        # Peer is 1.2.3.4 — not in 10.0.0.0/8. The cf-connecting-ip header
        # is attacker-spoofable; trust nothing.
        conn =
          conn_with(
            remote_ip: {1, 2, 3, 4},
            headers: [{"cf-connecting-ip", "9.9.9.9"}]
          )

        assert "1.2.3.4" == RemoteIp.from_conn(conn)
      end)
    end

    test "/24 mask correctly narrows trust" do
      with_proxies(["10.0.0.0/24"], fn ->
        in_range = conn_with(remote_ip: {10, 0, 0, 50}, headers: [{"cf-connecting-ip", "1.1.1.1"}])
        out_range = conn_with(remote_ip: {10, 0, 1, 1}, headers: [{"cf-connecting-ip", "1.1.1.1"}])

        assert "1.1.1.1" == RemoteIp.from_conn(in_range)
        assert "10.0.1.1" == RemoteIp.from_conn(out_range)
      end)
    end

    test "IPv6 remote_ip → falls back to remote_ip (IPv4-only CIDR)" do
      with_proxies(["10.0.0.0/8"], fn ->
        ipv6 = {0, 0, 0, 0, 0, 0, 0, 1}
        conn = conn_with(remote_ip: ipv6, headers: [{"cf-connecting-ip", "9.9.9.9"}])
        assert "::1" == RemoteIp.from_conn(conn)
      end)
    end
  end

  describe "validate_trusted_proxies!/0" do
    test "raises when all configured entries are malformed" do
      with_proxies(["nope", "also-bad"], fn ->
        assert_raise RuntimeError, ~r/refusing to boot/i, fn ->
          RemoteIp.validate_trusted_proxies!()
        end
      end)
    end

    test "logs but doesn't raise when at least one entry is valid" do
      with_proxies(["10.0.0.0/8", "nope"], fn ->
        log =
          ExUnit.CaptureLog.capture_log(fn ->
            assert :ok == RemoteIp.validate_trusted_proxies!()
          end)

        assert log =~ "malformed trusted_proxies entry"
      end)
    end

    test "empty config is a clean no-op" do
      with_proxies([], fn ->
        assert :ok == RemoteIp.validate_trusted_proxies!()
      end)
    end
  end
end
