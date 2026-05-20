defmodule DiversifWeb.AuthLive.Signup do
  use DiversifWeb, :live_view

  alias Diversif.Accounts
  alias Diversif.Accounts.User

  @impl true
  def mount(_params, _session, socket) do
    changeset = Accounts.change_user_registration()

    {:ok,
     socket
     |> assign(:page_title, "Créer un compte")
     |> assign(:trigger_submit, false)
     |> assign(:form, to_form(changeset, as: :user))}
  end

  @impl true
  def handle_event("validate", %{"user" => params}, socket) do
    changeset =
      %User{}
      |> User.registration_changeset(params)
      |> Map.put(:action, :validate)

    {:noreply, assign(socket, :form, to_form(changeset, as: :user))}
  end

  def handle_event("submit", %{"user" => params}, socket) do
    changeset =
      %User{}
      |> User.registration_changeset(params)
      |> Map.put(:action, :insert)

    if changeset.valid? do
      {:noreply,
       socket
       |> assign(:form, to_form(params, as: :user))
       |> assign(:trigger_submit, true)}
    else
      {:noreply, assign(socket, :form, to_form(changeset, as: :user))}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <div class="mx-auto max-w-sm">
        <h1 class="text-2xl font-semibold mb-6">Créer un compte</h1>

        <.form
          for={@form}
          action={~p"/signup"}
          method="post"
          phx-change="validate"
          phx-submit="submit"
          phx-trigger-action={@trigger_submit}
          class="space-y-4"
        >
          <.input
            field={@form[:display_name]}
            type="text"
            label="Prénom"
            autocomplete="given-name"
            required
          />
          <.input field={@form[:email]} type="email" label="Adresse e-mail" autocomplete="email" required />
          <.input
            field={@form[:password]}
            type="password"
            label="Mot de passe"
            autocomplete="new-password"
            minlength="12"
            required
          />

          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" name="user[tos]" value="true" required class="mt-1" />
            <span>
              J'accepte les <.link navigate={~p"/cgu"} class="underline">conditions d'utilisation</.link>
            </span>
          </label>

          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" name="user[privacy]" value="true" required class="mt-1" />
            <span>
              J'accepte la
              <.link navigate={~p"/politique-confidentialite"} class="underline">politique de confidentialité</.link>
            </span>
          </label>

          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" name="user[age]" value="true" required class="mt-1" />
            <span>Je confirme avoir 18 ans ou plus.</span>
          </label>

          <button type="submit" class="w-full rounded bg-zinc-900 text-white py-2 font-medium">
            Créer mon compte
          </button>
        </.form>

        <p class="mt-6 text-sm text-zinc-600">
          Déjà inscrit ?
          <.link navigate={~p"/login"} class="underline">Se connecter</.link>
        </p>
      </div>
    </Layouts.app>
    """
  end
end
