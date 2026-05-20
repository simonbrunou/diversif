defmodule DiversifWeb.Plugs.RateLimitTest do
  use ExUnit.Case, async: false

  import Plug.Test

  alias DiversifWeb.Plugs.RateLimit

  setup do
    RateLimit.ensure_table()
    {:ok, bucket: "test#{System.unique_integer([:positive])}"}
  end

  defp conn_for(ip) do
    conn(:get, "/")
    |> Map.put(:remote_ip, ip)
  end

  test "first `limit` requests pass, the next one halts with 429", %{bucket: bucket} do
    opts = [bucket: bucket, limit: 3, window: 60]
    ip = {1, 2, 3, 4}

    for _ <- 1..3 do
      conn = RateLimit.call(conn_for(ip), opts)
      refute conn.halted
    end

    conn = RateLimit.call(conn_for(ip), opts)
    assert conn.halted
    assert conn.status == 429
  end

  test "different IPs don't share buckets", %{bucket: bucket} do
    opts = [bucket: bucket, limit: 1, window: 60]

    refute RateLimit.call(conn_for({1, 1, 1, 1}), opts).halted
    refute RateLimit.call(conn_for({2, 2, 2, 2}), opts).halted
  end

  test "stamps older than the window are pruned", %{bucket: bucket} do
    opts = [bucket: bucket, limit: 1, window: 1]
    ip = {3, 3, 3, 3}

    refute RateLimit.call(conn_for(ip), opts).halted
    # 1.5 s > window — the old timestamp should age out.
    Process.sleep(1500)
    refute RateLimit.call(conn_for(ip), opts).halted
  end
end
