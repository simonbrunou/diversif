defmodule DiversifWeb.RemoteIp do
  @moduledoc """
  Resolves the originating client IP from a conn. Centralised so the rate
  limiter and the audit log can't disagree.

  Trust chain (first match wins):

    1. `cf-connecting-ip` if the request came through a configured trusted
       proxy (Cloudflare in our reference deploy — see project
       `reference_komodo.md`).
    2. The first hop in `x-forwarded-for`, if same trusted-proxy guard.
    3. `conn.remote_ip` as the unconditional fallback.

  Configure the trusted-proxy set via:

      config :diversif, :trusted_proxies, ["10.0.0.0/8", "127.0.0.1/32"]

  An empty / missing list means **no proxy is trusted** and we fall back to
  `conn.remote_ip` — which is the safe default for a direct-deploy or while
  the proxy ranges aren't yet known.
  """

  import Bitwise

  def from_conn(conn) do
    if trusted_proxy?(conn.remote_ip) do
      cf_ip(conn) || xff_first(conn) || remote_ip_str(conn)
    else
      remote_ip_str(conn)
    end
  end

  defp cf_ip(conn) do
    case Plug.Conn.get_req_header(conn, "cf-connecting-ip") do
      [val | _] -> String.trim(val)
      _ -> nil
    end
  end

  defp xff_first(conn) do
    case Plug.Conn.get_req_header(conn, "x-forwarded-for") do
      [val | _] -> val |> String.split(",") |> List.first() |> String.trim()
      _ -> nil
    end
  end

  defp remote_ip_str(%{remote_ip: nil}), do: "unknown"

  defp remote_ip_str(%{remote_ip: ip}) when is_tuple(ip) do
    case :inet.ntoa(ip) do
      {:error, _} -> "unknown"
      str -> to_string(str)
    end
  end

  defp remote_ip_str(_), do: "unknown"

  defp trusted_proxy?(nil), do: false

  defp trusted_proxy?(ip) when is_tuple(ip) do
    proxies = Application.get_env(:diversif, :trusted_proxies, [])

    Enum.any?(proxies, fn cidr -> in_cidr?(ip, cidr) end)
  end

  defp trusted_proxy?(_), do: false

  # Minimal IPv4 CIDR check — enough for the documented deploy. IPv6 CIDR
  # support can land alongside the first IPv6 proxy if needed.
  defp in_cidr?({_, _, _, _} = ip, cidr) when is_binary(cidr) do
    with [addr, bits_str] <- String.split(cidr, "/"),
         {bits, ""} <- Integer.parse(bits_str),
         # Reject malformed CIDRs early. `<<<` with a negative shift produces
         # nonsense; a missing bounds check would silently accept `/33`.
         true <- bits in 0..32,
         {:ok, net} <- :inet.parse_ipv4_address(String.to_charlist(addr)) do
      mask =
        if bits == 0, do: 0, else: 0xFFFFFFFF <<< (32 - bits) &&& 0xFFFFFFFF

      (ip_to_int(ip) &&& mask) == (ip_to_int(net) &&& mask)
    else
      _ -> false
    end
  end

  defp in_cidr?(_, _), do: false

  defp ip_to_int({a, b, c, d}), do: a <<< 24 ||| b <<< 16 ||| c <<< 8 ||| d
end
