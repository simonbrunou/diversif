defmodule DiversifWeb.Router do
  use DiversifWeb, :router

  import DiversifWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {DiversifWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_current_user
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :webauthn_api do
    plug :accepts, ["json"]
    plug :fetch_session
    plug :fetch_current_user
  end

  pipeline :login_throttle do
    plug DiversifWeb.Plugs.RateLimit, bucket: "login", limit: 10, window: 60
  end

  pipeline :signup_throttle do
    plug DiversifWeb.Plugs.RateLimit, bucket: "signup", limit: 5, window: 60
  end

  # ---------------------------------------------------------------------------
  # Public routes
  # ---------------------------------------------------------------------------
  scope "/", DiversifWeb do
    pipe_through :browser

    live_session :public,
      on_mount: [{DiversifWeb.UserAuth, :mount_current_user}] do
      live "/guide", GuideLive
      live "/cgu", LegalLive.Cgu
      live "/politique-confidentialite", LegalLive.Privacy
      live "/mentions-legales", LegalLive.MentionsLegales
      live "/cookies", LegalLive.Cookies
      live "/sources", LegalLive.Sources
      live "/join/:code", JoinLive
    end

    get "/healthz", HealthController, :show
    # robots.txt is served statically from priv/static/robots.txt; sitemap is
    # dynamic so the host matches the deployment.
    get "/sitemap.xml", SiteController, :sitemap
  end

  # ---------------------------------------------------------------------------
  # Guest-only
  # ---------------------------------------------------------------------------
  scope "/", DiversifWeb do
    pipe_through :browser

    live_session :guest_only,
      on_mount: [{DiversifWeb.UserAuth, :redirect_if_authenticated}] do
      live "/login", AuthLive.Login
      live "/signup", AuthLive.Signup
    end
  end

  scope "/", DiversifWeb do
    pipe_through [:browser, :login_throttle]
    post "/login", SessionController, :create
  end

  scope "/", DiversifWeb do
    pipe_through [:browser, :signup_throttle]
    post "/signup", RegistrationController, :create
  end

  # ---------------------------------------------------------------------------
  # Authenticated
  # ---------------------------------------------------------------------------
  scope "/", DiversifWeb do
    pipe_through [:browser, :require_authenticated_user]

    live_session :authenticated,
      on_mount: [{DiversifWeb.UserAuth, :ensure_authenticated}] do
      live "/", HomeLive
      live "/allergens", AllergensLive

      live "/child/new", ChildLive.New
      live "/child/:id", ChildLive.Show
      live "/child/:id/log", ChildLive.Log
      live "/child/:id/foods", ChildLive.History
      live "/child/:id/foods/:entry_id", ChildLive.Entry
      live "/child/:id/foods/:entry_id/edit", ChildLive.Edit
      live "/child/:id/foods/:entry_id/print", ChildLive.Print
      live "/child/:id/settings", ChildLive.Settings
      live "/child/:id/invite", ChildLive.Invite
      live "/child/:id/guide", ChildLive.Guide
      live "/child/:id/suggestions", ChildLive.Suggestions
      live "/child/:id/report", ChildLive.Report

      live "/account", AccountLive.Index
      live "/account/profile", AccountLive.Profile
      live "/account/password", AccountLive.Password
      live "/account/sessions", AccountLive.Sessions
      live "/account/passkeys", AccountLive.Passkeys
      live "/account/export", AccountLive.Export
      live "/account/delete", AccountLive.Delete
    end

    delete "/logout", SessionController, :delete
  end

  # ---------------------------------------------------------------------------
  # WebAuthn JSON API
  # ---------------------------------------------------------------------------
  scope "/api/webauthn", DiversifWeb do
    pipe_through :webauthn_api

    post "/authentication/options", WebauthnController, :authentication_options
    post "/authentication/verify", WebauthnController, :authentication_verify
  end

  scope "/api/webauthn", DiversifWeb do
    pipe_through [:webauthn_api, :require_authenticated_user]

    post "/registration/options", WebauthnController, :registration_options
    post "/registration/verify", WebauthnController, :registration_verify
    get "/passkeys", WebauthnController, :list_passkeys
    put "/passkeys/:id", WebauthnController, :rename_passkey
    delete "/passkeys/:id", WebauthnController, :delete_passkey
  end

  # ---------------------------------------------------------------------------
  # Dev dashboard
  # ---------------------------------------------------------------------------
  if Application.compile_env(:diversif, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser
      live_dashboard "/dashboard", metrics: DiversifWeb.Telemetry
    end
  end
end
