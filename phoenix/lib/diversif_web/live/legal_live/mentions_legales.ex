defmodule DiversifWeb.LegalLive.MentionsLegales do
  use DiversifWeb, :live_view

  def mount(_params, _session, socket), do: {:ok, assign(socket, :page_title, "Mentions légales")}

  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <article class="prose max-w-none">
        <h1>Mentions légales</h1>
        <p>
          Diversif est édité à titre privé. Toute question peut être adressée par e-mail.
        </p>
      </article>
    </Layouts.app>
    """
  end
end
