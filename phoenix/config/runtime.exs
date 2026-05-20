import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/diversif start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :diversif, DiversifWeb.Endpoint, server: true
end

config :diversif, DiversifWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

# WebAuthn origin & relying-party id. The browser sends the page origin in
# clientDataJSON without a trailing slash; we normalize ours to match (the
# SvelteKit port had the same defensive trim — operators write
# ORIGIN=https://example.com/ in env files often enough that exact-string
# compare breaks verification).
webauthn_origin =
  (System.get_env("ORIGIN") || "http://localhost:4000")
  |> String.trim()
  |> String.replace_trailing("/", "")

webauthn_rp_id =
  case URI.new(webauthn_origin) do
    {:ok, %URI{host: host}} when is_binary(host) -> host
    _ -> "localhost"
  end

config :diversif, :webauthn,
  origin: webauthn_origin,
  rp_id: webauthn_rp_id,
  rp_name: "Diversif"

config :wax_,
  origin: webauthn_origin,
  rp_id: webauthn_rp_id,
  # Our DB-backed challenge table enforces a 5 min TTL — wax_'s in-memory
  # timeout is a redundant cross-check; align it for clarity.
  timeout: 300,
  user_verification: "preferred"

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :diversif, Diversif.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host =
    System.get_env("PHX_HOST") ||
      raise """
      environment variable PHX_HOST is missing. Set it to the public hostname
      of this deploy (no scheme, no trailing slash). Falling back to a
      placeholder leaks "example.com" into sitemap.xml and every URL the
      Endpoint generates.
      """

  config :diversif, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  live_view_salt =
    System.get_env("LIVE_VIEW_SIGNING_SALT") ||
      raise """
      environment variable LIVE_VIEW_SIGNING_SALT is missing.
      Generate one with: mix phx.gen.secret 32
      """

  config :diversif, DiversifWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base,
    live_view: [signing_salt: live_view_salt],
    force_ssl: [hsts: true]

  # Trust the Cloudflare / proxy chain only when explicitly configured. Read
  # comma-separated CIDRs from TRUSTED_PROXIES, e.g.
  # "173.245.48.0/20,103.21.244.0/22,...". An empty / missing value falls
  # back to "trust nothing" and the rate limiter / audit keys on
  # conn.remote_ip — the secure default for a direct-deploy.
  trusted_proxies =
    case System.get_env("TRUSTED_PROXIES") do
      nil -> []
      "" -> []
      raw -> raw |> String.split(",") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))
    end

  config :diversif, :trusted_proxies, trusted_proxies

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :diversif, DiversifWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :diversif, DiversifWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
