defmodule DiversifWeb.HealthController do
  use DiversifWeb, :controller

  alias Diversif.Repo

  @doc """
  Serves both `/health` (Coolify / k8s / Traefik convention) and `/healthz`
  (Phoenix scaffold convention). Returns 200 with `OK` when the Repo can
  complete `SELECT 1`, 503 with `FAIL` otherwise.

  Plain `text/plain` body bypasses content negotiation entirely — the
  browser pipeline only registers `["html"]`, so a probe sending
  `Accept: text/plain` or `Accept: application/json` would otherwise hit
  a 406 Not Acceptable. Healthchecks shouldn't care about Accept; we
  ignore it.
  """
  def show(conn, _params) do
    case Ecto.Adapters.SQL.query(Repo, "SELECT 1", []) do
      {:ok, _} ->
        conn
        |> put_resp_content_type("text/plain")
        |> send_resp(200, "OK")

      _ ->
        conn
        |> put_resp_content_type("text/plain")
        |> send_resp(503, "FAIL")
    end
  end
end
