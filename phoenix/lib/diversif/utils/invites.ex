defmodule Diversif.Utils.Invites do
  @moduledoc """
  Invite code generator. Mirrors `src/lib/utils/invites.ts`.

  Alphabet excludes ambiguous chars (0, O, I, 1). 6 chars over 32 = ~10^9 combos;
  with a 7-day TTL and signup rate limiting, brute force is impractical.
  """

  @alphabet ~c"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  @code_length 6
  @legacy_length 4

  @spec generate_code() :: String.t()
  def generate_code do
    suffix =
      for <<b <- :crypto.strong_rand_bytes(@code_length)>>,
          into: "",
          do: <<Enum.at(@alphabet, rem(b, length(@alphabet)))>>

    "BEBE-" <> suffix
  end

  @spec valid_format?(String.t()) :: boolean()
  def valid_format?(code) when is_binary(code) do
    pattern =
      Regex.compile!("^BEBE-([A-Z2-9]{#{@legacy_length}}|[A-Z2-9]{#{@code_length}})$")

    Regex.match?(pattern, code) and not String.match?(code, ~r/[0OI1]/)
  end

  def valid_format?(_), do: false
end
