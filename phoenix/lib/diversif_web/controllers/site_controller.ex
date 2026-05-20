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

  # Pull the canonical scheme/host from Endpoint config instead of the request
  # Host header so a hostile `Host: evil.example` can't poison the sitemap.
  defp base_url(_conn) do
    %URI{scheme: scheme, host: host, port: port} =
      DiversifWeb.Endpoint.struct_url()

    case {scheme, port} do
      {"http", 80} -> "http://#{host}"
      {"https", 443} -> "https://#{host}"
      _ -> "#{scheme}://#{host}:#{port}"
    end
  end
end
