defmodule DiversifWeb.AccountLive.Passkeys do
  use DiversifWeb, :live_view

  alias Diversif.Webauthn

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Clés d'accès")
     |> assign(:passkeys, Webauthn.list_passkeys(socket.assigns.current_user.id))}
  end

  @impl true
  def handle_event("delete", %{"id" => id}, socket) do
    user_id = socket.assigns.current_user.id

    if Webauthn.delete_passkey(user_id, id) do
      {:noreply,
       socket
       |> assign(:passkeys, Webauthn.list_passkeys(user_id))
       |> put_flash(:info, "Clé supprimée.")}
    else
      {:noreply, put_flash(socket, :error, "Suppression impossible.")}
    end
  end

  # The JS hook bubbles up these events after the WebAuthn ceremony lands so
  # we can refresh the list without a full page reload.
  def handle_event("passkey:added", _payload, socket) do
    {:noreply,
     socket
     |> assign(:passkeys, Webauthn.list_passkeys(socket.assigns.current_user.id))
     |> put_flash(:info, "Clé enregistrée.")}
  end

  def handle_event("passkey:error", %{"error" => msg}, socket) do
    {:noreply, put_flash(socket, :error, "Échec de l'enregistrement : #{msg}")}
  end

  def handle_event("passkey:unsupported", _payload, socket) do
    {:noreply,
     put_flash(socket, :error, "Votre navigateur ne prend pas en charge les clés d'accès.")}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <p class="text-sm mb-2"><.link navigate={~p"/account"} class="underline">← Mon compte</.link></p>
      <h1 class="text-2xl font-semibold mb-2">Clés d'accès</h1>
      <p class="text-sm text-zinc-600 mb-6">
        Une clé d'accès vous permet de vous connecter sans mot de passe.
      </p>

      <div class="rounded border border-zinc-200 p-4 mb-6">
        <label for="passkey-name" class="block text-sm font-medium mb-1">
          Nom de l'appareil
        </label>
        <input
          type="text"
          id="passkey-name"
          placeholder="iPhone, MacBook…"
          maxlength="80"
          class="w-full rounded border border-zinc-300 px-3 py-2 mb-3"
        />
        <button
          type="button"
          id="passkey-register-btn"
          phx-hook="PasskeyRegister"
          data-name-input="#passkey-name"
          class="rounded bg-zinc-900 text-white px-3 py-2 text-sm font-medium"
        >
          Enregistrer cette clé
        </button>
      </div>

      <div :if={@passkeys == []} class="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        Aucune clé enregistrée.
      </div>

      <ul class="space-y-2">
        <li :for={p <- @passkeys} class="rounded border border-zinc-200 px-4 py-3 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium">{p.name}</div>
              <div class="text-xs text-zinc-500">
                {p.device_type}
                <span :if={p.backed_up}> · synchronisée</span>
                <span :if={p.last_used_at}>
                  · utilisée {Calendar.strftime(p.last_used_at, "%d/%m/%Y")}
                </span>
              </div>
            </div>
            <button
              phx-click="delete"
              phx-value-id={p.id}
              data-confirm={"Supprimer #{p.name} ?"}
              class="text-rose-600 underline text-xs"
            >
              Supprimer
            </button>
          </div>
        </li>
      </ul>
    </Layouts.app>
    """
  end
end
