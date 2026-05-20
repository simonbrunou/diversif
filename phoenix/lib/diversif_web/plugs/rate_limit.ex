defmodule DiversifWeb.Plugs.RateLimit do
  @moduledoc """
  Per-IP sliding-window rate limiter. State lives in a named ETS table that
  is created at boot by `Diversif.Application` (see `ensure_table/0`) — that's
  why we don't try to create it inside `call/2` (two concurrent requests right
  after a restart would race on `:ets.new` with `:named_table`).

  Single-node only. Under a paired-stack zero-downtime deploy (Komodo
  pattern, see project memory) the budget is per BEAM node, not per
  deployment — call that out in ops docs before scaling out.

  Usage:

      plug DiversifWeb.Plugs.RateLimit, bucket: "login", limit: 10, window: 60
  """

  import Plug.Conn

  @table :diversif_rate_limit

  @doc false
  def ensure_table do
    case :ets.whereis(@table) do
      :undefined ->
        :ets.new(@table, [:named_table, :public, :set, {:write_concurrency, true}])

      _ ->
        :ok
    end
  end

  def init(opts), do: opts

  def call(conn, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    limit = Keyword.fetch!(opts, :limit)
    window = Keyword.fetch!(opts, :window)

    ip = DiversifWeb.RemoteIp.from_conn(conn)
    now = System.system_time(:second)
    cutoff = now - window
    key = {bucket, ip}

    timestamps =
      case :ets.lookup(@table, key) do
        [{^key, ts}] -> Enum.filter(ts, &(&1 > cutoff))
        [] -> []
      end

    if length(timestamps) >= limit do
      conn
      |> put_resp_content_type("text/plain")
      |> send_resp(429, "Trop de tentatives. Réessayez plus tard.")
      |> halt()
    else
      :ets.insert(@table, {key, [now | timestamps]})
      conn
    end
  end
end
