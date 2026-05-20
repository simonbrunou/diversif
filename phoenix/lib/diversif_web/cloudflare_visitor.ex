defmodule DiversifWeb.CloudflareVisitor do
  @moduledoc """
  `@before_compile` hook that overrides `call/2` on a Phoenix endpoint to
  translate Cloudflare's `CF-Visitor` header into the standard
  `X-Forwarded-Proto` header BEFORE Phoenix's auto-injected `Plug.SSL`
  runs.

  Cloudflare Tunnel (cloudflared) connects to the origin and signals the
  original client scheme via `CF-Visitor: {"scheme":"https"}`. It does NOT
  set `X-Forwarded-Proto`. `Plug.SSL`'s `:rewrite_on` only reads the
  standard `X-Forwarded-*` family, so without this shim every request
  301s to https://, Cloudflare forwards back as http, and we loop.

  This module is registered via `@before_compile` so the override lands
  AFTER `Plug.Builder.__before_compile__/1` has installed the endpoint's
  base `call/2`. A naked `defoverridable call: 2` in the endpoint body
  fails because `call/2` isn't defined yet at that point.
  """

  defmacro __before_compile__(_env) do
    quote do
      defoverridable call: 2

      def call(conn, opts) do
        conn
        |> unquote(__MODULE__).lift_cf_visitor_to_xfp()
        |> super(opts)
      end
    end
  end

  @doc false
  def lift_cf_visitor_to_xfp(conn) do
    case Plug.Conn.get_req_header(conn, "cf-visitor") do
      [json | _] ->
        case Phoenix.json_library().decode(json) do
          {:ok, %{"scheme" => scheme}} when scheme in ["http", "https"] ->
            Plug.Conn.put_req_header(conn, "x-forwarded-proto", scheme)

          _ ->
            conn
        end

      _ ->
        conn
    end
  end
end
