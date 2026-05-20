import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :diversif, Diversif.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  port: 5435,
  database: "diversif_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :diversif, DiversifWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "bT0xbLPG1AbEfxHXPxFa397sUmR44YUdJvQ+rmKpJAsgmm9LvYT/NXj3IT0dv95M",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Use the cheapest argon2 settings in test — real params would burn ~50ms per
# auth call and tests register users constantly.
config :argon2_elixir,
  t_cost: 1,
  m_cost: 8,
  parallelism: 1,
  argon2_type: 2

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true
