defmodule Diversif.Audit do
  @moduledoc """
  Append-only audit log for sensitive actions (login attempts, password change,
  account deletion, passkey ops, invite acceptance). Port of
  `src/lib/server/audit.ts` reduced to the minimum useful set.

  All writes go via `record/3`; never read back from app code (the table is for
  incident response, not feature logic).
  """

  import Ecto.Query

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
    # Audit MUST never break the path that called it. Worst case we lose a row.
    _ -> :ok
  end

  @doc """
  Count records matching event within the last `seconds`, optionally filtered
  by IP. Powers basic rate-limit checks.
  """
  def count_recent(event, seconds, opts \\ []) do
    since = DateTime.utc_now() |> DateTime.add(-seconds, :second)
    ip = opts[:ip]

    q = from a in @table, where: a.event == ^event and a.created_at >= ^since, select: count()
    q = if ip, do: where(q, [a], a.ip == ^ip), else: q

    Repo.one(q) || 0
  end
end
