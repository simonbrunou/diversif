defmodule DiversifWeb.SiteController do
  use DiversifWeb, :controller

  def sitemap(conn, _params) do
    base = base_url(conn)

    urls =
      [
        "/",
        "/login",
        "/signup",
        "/cgu",
        "/politique-confidentialite",
        "/mentions-legales",
        "/cookies",
        "/sources",
        "/guide"
      ]
      |> Enum.map(&"<url><loc>#{base}#{&1}</loc></url>")
      |> Enum.join("\n  ")

    body = ~s|<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  #{urls}
</urlset>
|

    conn
    |> put_resp_content_type("application/xml")
    |> send_resp(200, body)
  end

  defp base_url(conn) do
    scheme = if conn.scheme == :https, do: "https", else: "http"
    "#{scheme}://#{conn.host}"
  end
end
