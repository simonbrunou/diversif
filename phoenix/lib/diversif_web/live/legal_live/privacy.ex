defmodule DiversifWeb.LegalLive.Privacy do
  use DiversifWeb, :live_view

  def mount(_params, _session, socket), do: {:ok, assign(socket, :page_title, "Politique de confidentialité")}

  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <article class="prose max-w-none">
        <h1>Politique de confidentialité</h1>
        <p>Diversif respecte votre vie privée et celle de votre enfant.</p>
        <h2>Données collectées</h2>
        <ul>
          <li>Votre prénom et adresse e-mail (pour votre compte).</li>
          <li>Le prénom et la date de naissance de votre enfant.</li>
          <li>Les aliments introduits, réactions et symptômes consignés.</li>
        </ul>
        <h2>Conservation</h2>
        <p>
          Les données sont conservées tant que votre compte existe. Vous pouvez les exporter
          ou les supprimer à tout moment depuis votre compte.
        </p>
        <h2>Partage</h2>
        <p>
          Aucune donnée n'est partagée avec des tiers à des fins commerciales. Les coparents
          que vous invitez explicitement ont accès au suivi de l'enfant concerné.
        </p>
      </article>
    </Layouts.app>
    """
  end
end
