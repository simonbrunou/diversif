defmodule DiversifWeb.Gettext do
  @moduledoc """
  Gettext backend for diversif.

  French is the source locale: `msgid` strings throughout the app are
  written in French verbatim, the French catalog at
  `priv/gettext/fr/LC_MESSAGES/default.po` keeps empty `msgstr` entries
  (gettext falls back to the msgid in that case), and English translations
  live in `priv/gettext/en/LC_MESSAGES/default.po`.

      use Gettext, backend: DiversifWeb.Gettext

      gettext("Adresse e-mail")
      gettext("Né(e) le %{date}", date: "2025-08-01")
      dgettext("errors", "ne peut pas être vide")

  See https://hexdocs.pm/gettext for plural / domain helpers.
  """
  use Gettext.Backend,
    otp_app: :diversif,
    default_locale: "fr",
    locales: ~w(fr en)
end
