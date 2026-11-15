/**
 * The data scripts/check-i18n-quotes.ts reads (#366). Both maps apply to every
 * locale, and their keys are message keys.
 *
 * QUOTE_LINKS: for each message that quotes a UI label, the keys of the labels
 * it quotes. Each quoted span of that message must equal the current value,
 * in the same locale, of one of its linked keys. Link one key per quoted
 * label, the one whose text the reader sees on the control the copy names:
 * when two keys hold the same text, linking both lets either change unseen.
 *
 * ALLOWED_QUOTES: for each message that quotes a word that names no label,
 * the quoted texts, in every locale, that pass as they are.
 */
export const QUOTE_LINKS: Readonly<Record<string, readonly string[]>> = {
  // The chip that clears the category filter, right above this message (#359).
  foodComboboxNoneInCategory: ['foodComboboxFilterAll'],
  // The cookies page names the buttons that delete the session cookie. The
  // public header's button leads to /account, whose sessions page holds both
  // log-out buttons. authAccountHeading also reads « Mon compte », but the
  // reader of /cookies presses the header's button.
  legalCookiesFooterAfter: [
    'authAccountLogout',
    'chromePublicHeaderMyAccount',
    'authAccountLogoutEverywhere'
  ]
};

export const ALLOWED_QUOTES: Readonly<Record<string, readonly string[]>> = {
  // The GDPR category of the data, not a label.
  authSignupAcceptPrivacySuffix: ['santé', 'health']
};
