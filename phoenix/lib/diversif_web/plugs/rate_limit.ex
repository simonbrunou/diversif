defmodule DiversifWeb.Plugs.RateLimit do
  @moduledoc """
  Per-IP sliding-window rate limiter using a single ETS table.
  Keyed by `{bucket, ip}`; each request appends a timestamp, then we trim and
  count. Cheap, in-memory, single-node (good enough for the current deploy).

  Usage:

      plug DiversifWeb.Plugs.RateLimit, bucket: "login", limit: 10, window: 60

  Returns 429 if the limit is exceeded.
  """

  import Plug.Conn

  @table :diversif_rate_limit

  def init(opts), do: opts

  def call(conn, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    limit = Keyword.fetch!(opts, :limit)
    window = Keyword.fetch!(opts, :window)

    ensure_table()

    ip = client_ip(conn)
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

  defp ensure_table do
    case :ets.whereis(@table) do
      :undefined ->
        :ets.new(@table, [:named_table, :public, :set, {:write_concurrency, true}])

      _ ->
        :ok
    end
  end

  defp client_ip(conn) do
    case Plug.Conn.get_req_header(conn, "x-forwarded-for") do
      [val | _] -> val |> String.split(",") |> List.first() |> String.trim()
      _ -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end
end
