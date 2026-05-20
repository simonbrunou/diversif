defmodule DiversifWeb.AccountLive.Delete do
  use DiversifWeb, :live_view

  alias Diversif.Accounts
  alias Diversif.Repo

  @impl true
  def mount(_params, _session, socket) do
    form = to_form(%{"password" => "", "confirm" => ""}, as: :delete)
    {:ok, assign(socket, page_title: "Supprimer mon compte", form: form)}
  end

  @impl true
  def handle_event("save", %{"delete" => params}, socket) do
    user = socket.assigns.current_user

    cond do
      params["confirm"] != "SUPPRIMER" ->
        {:noreply, put_flash(socket, :error, "Tapez SUPPRIMER en majuscules pour confirmer.")}

      Accounts.get_user_by_email_and_password(user.email, params["password"]) == nil ->
        {:noreply, put_flash(socket, :error, "Mot de passe incorrect.")}

      true ->
        Repo.delete!(user)

        {:noreply,
         socket
         |> put_flash(:info, "Compte supprimé.")
         |> redirect(to: ~p"/logout")}
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/account"} class="underline">← Mon compte</.link></p>
      <h1 class="text-2xl font-semibold mb-6 text-rose-700">Supprimer mon compte</h1>
      <p class="text-sm text-zinc-700 mb-6">
        Cette action est définitive. Tous vos enfants, repas et symptômes seront effacés.
      </p>
      <.form for={@form} phx-submit="save" class="space-y-4 max-w-sm">
        <.input field={@form[:password]} type="password" label="Mot de passe" autocomplete="current-password" required />
        <.input field={@form[:confirm]} type="text" label='Tapez "SUPPRIMER" pour confirmer' required />
        <button type="submit" class="rounded bg-rose-600 text-white px-4 py-2 font-medium">
          Supprimer définitivement
        </button>
      </.form>
    </Layouts.app>
    """
  end
end
