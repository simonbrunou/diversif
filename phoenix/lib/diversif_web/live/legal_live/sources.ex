defmodule DiversifWeb.LegalLive.Sources do
  use DiversifWeb, :live_view

  def mount(_params, _session, socket), do: {:ok, assign(socket, :page_title, "Sources")}

  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_user={@current_user}>
      <article class="prose max-w-none">
        <h1>Sources scientifiques</h1>
        <ul>
          <li>HCSP, Avis relatif à l'alimentation des enfants de 0 à 36 mois (30/06/2020).</li>
          <li>LEAP study, Du Toit et al., NEJM 2015.</li>
          <li>EAT study, Perkin et al., NEJM 2016.</li>
          <li>ESPGHAN guidelines on complementary feeding, 2017.</li>
          <li>Règlement UE 1169/2011, Annexe II (14 allergènes).</li>
        </ul>
      </article>
    </Layouts.app>
    """
  end
end
