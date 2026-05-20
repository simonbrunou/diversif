defmodule Diversif.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Rate-limit ETS table needs to exist before the first request — creating
    # it lazily inside the plug races on cold start under concurrent traffic.
    DiversifWeb.Plugs.RateLimit.ensure_table()

    # Validate trusted-proxy CIDRs at boot so a typo logs once instead of
    # silently disabling X-Forwarded-For trust on every request forever.
    DiversifWeb.RemoteIp.validate_trusted_proxies!()

    children = [
      DiversifWeb.Telemetry,
      Diversif.Repo,
      {DNSCluster, query: Application.get_env(:diversif, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Diversif.PubSub},
      DiversifWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Diversif.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    DiversifWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
