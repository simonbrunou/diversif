---
name: warn-anglicism-fr-messages
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: messages/fr\.json$|messages/fr/.*\.json$
  - field: new_text
    operator: regex_match
    pattern: \b(Streak|streak|Stats|stats|Email|email|Logger|logger|Login|login|Logout|logout|Settings|Dashboard|Profile|Save|Update|Delete|Toggle)\b
---

⚠️ **Anglicism detected in French UI strings**

CLAUDE.md hard rule: French UI, NO anglicisms. PR reviewers reject regressions.

**Known mappings (from CLAUDE.md):**
- `logger` → **Enregistrer**
- `Streak` → **Régularité**
- `Email` → **Adresse e-mail**
- `Stats` → **Bilan**

**Other common slips:**
- `Login` / `Logout` → **Connexion** / **Déconnexion**
- `Settings` → **Paramètres**
- `Dashboard` → **Tableau de bord**
- `Save` → **Enregistrer**
- `Profile` → **Profil**
- `Update` / `Delete` → **Mettre à jour** / **Supprimer**
- `Toggle` → **Activer/Désactiver** (in context)

This is a `warn` rule because the pattern can false-positive on legitimate
edits (e.g. you're fixing an anglicism and the diff includes both old and
new context). The authoritative gate is `scripts/lint-i18n.mjs` +
`scripts/check-i18n-unused.mjs` at commit time.

If the match is a legitimate fix, proceed. If it's a regression, use the
French equivalent above.
