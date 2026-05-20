defmodule DiversifWeb.ProxySchemeTest do
  @moduledoc """
  Regression test for the force_ssl redirect loop behind a TLS-terminating
  proxy. The :test env doesn't set `force_ssl`, so we explicitly invoke
  Plug.SSL with the same options prod.exs uses and exercise its decision
  logic — that's the exact code path that was 301-looping in production.
  """

  use ExUnit.Case, async: true
  import Plug.Conn
  import Plug.Test

  @plug_ssl_opts [
    hsts: true,
    rewrite_on: [:x_forwarded_proto, :x_forwarded_host, :x_forwarded_port],
    exclude: [
      paths: ["/health", "/healthz"],
      hosts: ["localhost", "127.0.0.1"]
    ]
  ]

  defp ssl_init, do: Plug.SSL.init(@plug_ssl_opts)

  defp call(conn, opts), do: Plug.SSL.call(conn, opts)

  test "request with X-Forwarded-Proto: https is NOT redirected" do
    opts = ssl_init()

    conn =
      conn(:get, "/login")
      |> Map.put(:host, "app.example.com")
      |> put_req_header("x-forwarded-proto", "https")
      |> call(opts)

    refute conn.halted
    refute conn.status == 301
  end

  test "request without X-Forwarded-Proto on a non-excluded host IS redirected to https" do
    opts = ssl_init()

    conn =
      conn(:get, "/login")
      |> Map.put(:host, "app.example.com")
      |> call(opts)

    assert conn.halted
    assert conn.status == 301

    [location] = Plug.Conn.get_resp_header(conn, "location")
    assert String.starts_with?(location, "https://app.example.com")
  end

  test "/healthz is never redirected (path exclusion)" do
    opts = ssl_init()

    conn =
      conn(:get, "/healthz")
      |> Map.put(:host, "app.example.com")
      |> call(opts)

    refute conn.halted
  end

  test "/health is never redirected (path exclusion)" do
    opts = ssl_init()

    conn =
      conn(:get, "/health")
      |> Map.put(:host, "app.example.com")
      |> call(opts)

    refute conn.halted
  end
end
