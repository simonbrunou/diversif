defmodule DiversifWeb.AccountLive.Index do
  use DiversifWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :page_title, "Mon compte")}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <h1 class="text-2xl font-semibold mb-6">Mon compte</h1>

      <div class="rounded border border-zinc-200 p-4 mb-4">
        <p class="font-medium">{@current_user.display_name}</p>
        <p class="text-sm text-zinc-500">{@current_user.email}</p>
      </div>

      <ul class="divide-y divide-zinc-200 rounded border border-zinc-200">
        <li><.row to={~p"/account/profile"} label="Profil" hint="Modifier votre prénom" /></li>
        <li><.row to={~p"/account/password"} label="Mot de passe" hint="Changer votre mot de passe" /></li>
        <li><.row to={~p"/account/passkeys"} label="Clés d'accès" hint="Passkeys (WebAuthn)" /></li>
        <li><.row to={~p"/account/sessions"} label="Sessions" hint="Appareils connectés" /></li>
        <li><.row to={~p"/account/export"} label="Exporter mes données" hint="Téléchargement RGPD" /></li>
        <li><.row to={~p"/account/delete"} label="Supprimer mon compte" hint="Suppression définitive" danger /></li>
      </ul>
    </Layouts.app>
    """
  end

  attr :to, :string, required: true
  attr :label, :string, required: true
  attr :hint, :string, default: nil
  attr :danger, :boolean, default: false

  defp row(assigns) do
    ~H"""
    <.link navigate={@to} class={[
      "block px-4 py-3 hover:bg-zinc-50",
      @danger && "text-rose-700"
    ]}>
      <div class="font-medium">{@label}</div>
      <div :if={@hint} class="text-sm text-zinc-500">{@hint}</div>
    </.link>
    """
  end
end
