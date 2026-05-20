defmodule Diversif.Audit do
  @moduledoc """
  Append-only audit log for sensitive actions (login attempts, password change,
  account deletion, passkey ops, invite acceptance). Port of
  `src/lib/server/audit.ts` reduced to the minimum useful set.

  Writes go via `record/3`. Reads exist (`count_recent/3`) only for
  abuse-detection counters — never let business logic depend on them.
  """

  require Logger

  alias Diversif.Repo

  @table "audit_events"

  @spec record(String.t(), map(), keyword()) :: :ok
  def record(event, meta \\ %{}, opts \\ []) when is_binary(event) do
    row = %{
      user_id: opts[:user_id],
      event: event,
      ip: opts[:ip],
      meta: meta,
      created_at: DateTime.utc_now()
    }

    Repo.insert_all(@table, [row])
    :ok
  rescue
    # The contract is "audit MUST never break the caller" — so we eat DB
    # failures. But naked `_` would also swallow `ArgumentError` from a bad
    # meta map (a developer bug we want to crash on in dev/test). Scope the
    # rescue and log so a degraded Postgres at the worst moment (deploy,
    # incident) doesn't vanish from telemetry.
    e in [DBConnection.ConnectionError, Postgrex.Error, Ecto.QueryError] ->
      Logger.error("audit.record dropped: #{Exception.message(e)} event=#{event}")
      :ok
  end

  @doc """
  Count records matching event within the last `seconds`, optionally filtered
  by IP. Powers abuse-detection counters in admin/observability tooling.
  Not used as a security gate — see `DiversifWeb.Plugs.RateLimit` for that.
  """
  def count_recent(event, seconds, opts \\ []) do
    import Ecto.Query

    since = DateTime.utc_now() |> DateTime.add(-seconds, :second)
    ip = opts[:ip]

    q = from a in @table, where: a.event == ^event and a.created_at >= ^since, select: count()
    q = if ip, do: where(q, [a], a.ip == ^ip), else: q

    Repo.one(q) || 0
  end
end
