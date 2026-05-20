defmodule Diversif.Repo do
  use Ecto.Repo,
    otp_app: :diversif,
    adapter: Ecto.Adapters.Postgres
end
