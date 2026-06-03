---
name: testing-diversif
description: Test the Diversif app end-to-end locally. Use when verifying UI changes to authenticated pages (guide, foods, dashboard).
---

# Testing Diversif Locally

## Prerequisites

- Dev server running: `DATABASE_PATH=./dev.db WEBAUTHN_RP_ID=localhost bun run dev`
- Server runs at http://localhost:5173
- Uses SQLite (dev.db) — no external DB needed

## Auth Flow (Browser)

1. Navigate to `/signup`
2. Fill: "Votre prénom", "Adresse e-mail" (any @example.com), "Mot de passe" (12+ chars)
3. Check all 3 checkboxes (age, ToS, privacy)
4. Click "Créer mon compte"
5. Lands on `/child/new` — fill "Prénom" + "Date de naissance" → click "Créer"
6. Welcome modal appears — dismiss with "Plus tard" button
7. Now authenticated at `/child/{id}`

## Key Navigation

- **Dashboard**: `/child/{id}` (sidebar: "Aujourd'hui")
- **Food log**: `/child/{id}/foods` (sidebar: "Carnet")
- **Guide/Discover**: `/child/{id}/guide` (sidebar: "Découvrir")
- **Public guide**: `/guide` (no auth needed, has allergen section)
- **Profile**: `/account`

## Child Age & Stages

The guide page shows stages based on child age:
- 4–6 mois
- 6–9 mois
- 9–12 mois
- 12 mois–3 ans

Set birth date accordingly to test specific stages. E.g., for 6–9 mois stage, use a birth date ~7 months ago.

## Tips

- The app is entirely in French — all UI text, labels, buttons are French
- Date input uses mm/dd/yyyy format in Chrome
- After signup, the child ID is in the URL: `/child/1`, `/child/2`, etc.
- WebAuthn passkey auth is also available but email/password is simpler for testing
- If dev.db already has data from previous runs, you might get email conflicts — use unique emails
- E2E tests use Playwright: `bun run test:e2e`
- Unit tests: `bun test`

## Devin Secrets Needed

None — local dev uses SQLite with no external services.
