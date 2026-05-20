defmodule DiversifWeb.AuthLive.Login do
  use DiversifWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    form = to_form(%{"email" => "", "password" => ""}, as: :session)

    {:ok,
     socket
     |> assign(:page_title, "Se connecter")
     |> assign(:trigger_submit, false)
     |> assign(:form, form)}
  end

  @impl true
  def handle_event("validate", %{"session" => params}, socket) do
    {:noreply, assign(socket, :form, to_form(params, as: :session))}
  end

  def handle_event("submit", %{"session" => params}, socket) do
    {:noreply,
     socket
     |> assign(:form, to_form(params, as: :session))
     |> assign(:trigger_submit, true)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <div class="mx-auto max-w-sm">
        <h1 class="text-2xl font-semibold mb-6">Se connecter</h1>

        <.form
          for={@form}
          action={~p"/login"}
          method="post"
          phx-change="validate"
          phx-submit="submit"
          phx-trigger-action={@trigger_submit}
          class="space-y-4"
        >
          <.input
            field={@form[:email]}
            type="email"
            label="Adresse e-mail"
            autocomplete="username webauthn"
            required
          />
          <.input
            field={@form[:password]}
            type="password"
            label="Mot de passe"
            autocomplete="current-password"
            required
          />
          <button type="submit" class="w-full rounded bg-zinc-900 text-white py-2 font-medium">
            Se connecter
          </button>
        </.form>

        <div class="my-4 flex items-center gap-3">
          <span class="flex-1 border-t border-zinc-200"></span>
          <span class="text-xs uppercase tracking-wide text-zinc-500">ou</span>
          <span class="flex-1 border-t border-zinc-200"></span>
        </div>

        <button
          type="button"
          id="passkey-auth-btn"
          phx-hook="PasskeyAuthenticate"
          class="w-full rounded border border-zinc-300 py-2 font-medium"
        >
          Se connecter avec une clé d'accès
        </button>

        <p class="mt-6 text-sm text-zinc-600">
          Pas encore de compte ?
          <.link navigate={~p"/signup"} class="underline">Créer un compte</.link>
        </p>
      </div>
    </Layouts.app>
    """
  end
end
