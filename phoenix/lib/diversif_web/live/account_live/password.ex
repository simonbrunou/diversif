defmodule DiversifWeb.AccountLive.Password do
  use DiversifWeb, :live_view

  alias Diversif.Accounts
  alias Diversif.Accounts.User
  alias Diversif.Repo

  @impl true
  def mount(_params, _session, socket) do
    form = to_form(%{"current" => "", "new" => "", "confirm" => ""}, as: :pw)
    {:ok, assign(socket, page_title: "Mot de passe", form: form)}
  end

  @impl true
  def handle_event("save", %{"pw" => params}, socket) do
    user = socket.assigns.current_user

    with %{"current" => current, "new" => new, "confirm" => confirm} <- params,
         true <- new == confirm or {:error, "Les mots de passe ne correspondent pas."},
         %User{} <-
           Accounts.get_user_by_email_and_password(user.email, current) ||
             {:error, "Mot de passe actuel incorrect."} do
      changeset = User.password_changeset(user, %{"password" => new})

      case Repo.update(changeset) do
        {:ok, _} ->
          # Invalidate every other session — the spirit of the SvelteKit version.
          Accounts.delete_all_user_sessions(user.id)

          {:noreply,
           socket
           |> put_flash(:info, "Mot de passe changé. Reconnectez-vous.")
           |> redirect(to: ~p"/logout")}

        {:error, cs} ->
          {:noreply, put_flash(socket, :error, summarize(cs))}
      end
    else
      {:error, msg} -> {:noreply, put_flash(socket, :error, msg)}
      _ -> {:noreply, put_flash(socket, :error, "Mot de passe actuel incorrect.")}
    end
  end

  defp summarize(%Ecto.Changeset{} = cs) do
    cs
    |> Ecto.Changeset.traverse_errors(fn {msg, _opts} -> msg end)
    |> Enum.map(fn {f, [msg | _]} -> "#{f}: #{msg}" end)
    |> Enum.join(", ")
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/account"} class="underline">← Mon compte</.link></p>
      <h1 class="text-2xl font-semibold mb-6">Changer le mot de passe</h1>
      <.form for={@form} phx-submit="save" class="space-y-4 max-w-sm">
        <.input field={@form[:current]} type="password" label="Mot de passe actuel" autocomplete="current-password" required />
        <.input field={@form[:new]} type="password" label="Nouveau mot de passe" autocomplete="new-password" minlength="12" required />
        <.input field={@form[:confirm]} type="password" label="Confirmer" autocomplete="new-password" minlength="12" required />
        <button type="submit" class="rounded bg-zinc-900 text-white px-4 py-2 font-medium">
          Enregistrer
        </button>
      </.form>
    </Layouts.app>
    """
  end
end
