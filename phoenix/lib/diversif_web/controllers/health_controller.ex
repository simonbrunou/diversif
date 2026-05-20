defmodule DiversifWeb.HealthController do
  use DiversifWeb, :controller

  alias Diversif.Repo

  def show(conn, _params) do
    case Ecto.Adapters.SQL.query(Repo, "SELECT 1", []) do
      {:ok, _} -> json(conn, %{ok: true})
      _ -> conn |> put_status(:service_unavailable) |> json(%{ok: false})
    end
  end
end
