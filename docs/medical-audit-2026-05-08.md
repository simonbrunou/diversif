# Medical-content audit — 2026-05-08

> **What this is:** an automated multi-agent audit of every medical / nutritional claim shipped in the diversif app, cross-referenced against the cited authoritative sources (HCSP 2020, SpF/PNNS 2021, ESPGHAN 2017, ANSES, WHO 2023, LEAP/EAT trials).
>
> **What this is NOT:** medical advice, a rewrite, or a green-light list. Several findings flag conservative app-policy choices that may be intentional. Owner / domain expert decides what to act on.
>
> **Why this exists:** an earlier "8 drift items" pass (2026-05-07) shipped a partial fix that introduced two successive internal contradictions (caught by Codex, then by the re-audit). The user lost confidence and asked for a thorough re-derivation from primary sources. This document is the result of three independent agents: PR-diff verification, age-claim audit, and quantity-claim audit.

## TL;DR

**Clear-cut bugs** (code or attribution wrong, no domain judgment needed):

1. 🚨 **Milestone "Les 12 allergènes prioritaires" toast can never fire.** Logic bug in `src/routes/child/[id]/log/+page.server.ts` — `allAllergensJustCompleted = isFirstAllergen && priorAllergensIntroduced + 1 === ALLERGENS.length` requires the first allergen ever logged to also be the 12th. Impossible.
2. 🚨 **`oeuf-cru` blocked `< 12 mois`** (`guidance.ts:647`) and tip `egg-fully-cooked` (`:860`) — HCSP says 0–3 ans for raw eggs / mayo maison.
3. 🚨 **Tofu seeded at age 6** (`seed.ts:79`) while `FORBIDDEN_FOODS[sojaboisson-3ans]` (`guidance.ts:683`) says soja products `< 3 ans`. Internal contradiction; HCSP backs the 3-yr stance for all soja products, not just drinks.
4. 🚨 **`allergens.ts:1` comment claims "12 priority allergens per the HCSP-2020 avis"** — HCSP names only `produits laitiers / œuf / arachide` explicitly. The 12 = **EU Regulation 1169/2011 minus lupin and sulphites** (a *labelling* list, not an introduction list).
5. 🚨 **Egg portion contradiction**: `oeuf.howToOffer` (`guidance.ts:240`) says "1/4 de **jaune**" (yolk only), focus text (`:73`) says "œuf entier ~1/4 puis 1/2", HCSP §2.7 says "œuf entier (jaune+blanc), ¼ entre 6–12 mois, 1/3 entre 1–2 ans, 1/2 entre 2–3 ans". App skips the 1/3 step and contradicts itself on yolk vs whole.
6. 🚨 **"Noix de beurre" translation bug** (`guidance.ts:69`): HCSP §2.9 highlights *huile de colza* and *huile de noix* (walnut oil, ALA-rich). App lists "huile de colza, huile d'olive, **noix de beurre**" — "noix de beurre" means *a knob of butter*, a different fat with different rationale.
7. 🚨 **Céleri in "viennent plus tard" list** (current `guidance.ts:74`, from the closed PR #52 attempt) while `celeri.recommendedAgeMonths: 6`.

**Editorial / domain-judgment items** (where authoritative sources differ from the app, and the app's stance may be intentionally conservative):

- All allergen `recommendedAgeMonths: 6` (HCSP allows 4)
- Meat grammage 30g at 1yr / 50g at 3yr (HCSP §2.7 says 20g 1–2yr / 30g 2–3yr — app off ~50%)
- Milk floor `~600–800 mL/j` at 4–6 mo (HCSP §2.1 says minimum 500 mL/j)
- Choking-hazard ages 4–5 yr (HCSP says 3 yr, AAP/SFP convention says 4–5)
- Crustacé/mollusque 12 mo, moutarde 9 mo (no source for specific numbers)
- Légumineuses "1–2/sem" (HCSP §2.4 "≥2/sem après 1 an")
- Salt framing as `< 12 mois` (HCSP §2.10 "limit at all ages")
- EAT trial "/3" framing (per-protocol only; ITT non-significant)
- LEAP/EAT cited together for "4–6 mois" (LEAP was 4–11; EAT was 3–4)

---

## Methodology

Three parallel agents fetched primary sources and re-derived findings independently:

- **Agent A — PR #52 diff verification.** Quoted ESPGHAN 2017 verbatim (PMID 28027215). Could not reach HCSP / Manger Bouger via WebFetch (consent gates, 404s).
- **Agent B — age-claim audit.** Successfully fetched the full HCSP 2020 PDF (`hcspa20200630_rvisidesreprealimepourlesenfan.pdf`) plus the SpF/Manger Bouger parent brochure. Cross-referenced every age-banded claim across `guidance.ts`, `seed.ts`, `allergens.ts`, `milestones.ts`, components, routes, and i18n messages.
- **Agent C — quantity-claim audit.** Same HCSP 2020 PDF. Walked every numeric claim (grams, mL, frequency, ratio).

Source URLs:

- HCSP avis 2020 PDF: https://www.hcsp.fr/Explore.cgi/Telecharger?NomFichier=hcspa20200630_rvisidesreprealimepourlesenfan.pdf
- SpF/Manger Bouger parent brochure: https://www.mangerbouger.fr/content/show/1500/file/Brochure-SPF-Mangerbougerfr.pdf
- Manger Bouger pro page (allergènes 4–6 mois): https://www.mangerbouger.fr/ressources-pros/ressources-documents-mooc-liens-utiles/professionnels-de-sante/introduire-les-allergenes-alimentaires-des-4-6-mois
- ESPGHAN 2017 Complementary Feeding (Fewtrell et al.): https://pubmed.ncbi.nlm.nih.gov/28027215/
- ANSES — fromages au lait cru: https://www.anses.fr/en/content/raw-milk-cheeses-what-are-associated-health-risks-and-what-preventive-measures-can-be-taken
- ANSES — jeunes enfants 0–3 ans: https://www.anses.fr/fr/system/files/NUT2017SA0145.pdf
- WHO complementary feeding 2023: https://www.who.int/publications/i/item/9789240081864

---

## Clear-cut bugs (detail)

### 1. Milestone "all 12 allergens" can never fire

**File:** `src/routes/child/[id]/log/+page.server.ts:194-195`

```ts
const isFirstAllergen = priorAllergenCount === 0 && food.allergenType != null;
const allAllergensJustCompleted =
  isFirstAllergen && priorAllergensIntroduced + 1 === ALLERGENS.length;
```

`isFirstAllergen` is true only when *this* allergen has never been logged for the child (`priorAllergenCount === 0`). Combined with the `+1 === ALLERGENS.length` clause, the celebration only fires if the first allergen logged is also the 12th — impossible.

**Fix shape:** drop the `isFirstAllergen &&` conjunct; the condition should be "this insert took us from N–1 distinct allergens to N (= ALLERGENS.length)". The existing `priorAllergensIntroduced` already counts distinct allergens pre-insert; checking `priorAllergensIntroduced + 1 === ALLERGENS.length && food.allergenType != null && priorAllergenCount === 0` (where `priorAllergenCount` is for *this* allergen, not all) is what was intended.

### 2. `oeuf-cru` and `egg-fully-cooked` use the wrong age cliff

**Files:** `src/lib/content/guidance.ts:647` and `:860`

App says "œufs crus / mayo maison: avant 12 mois". HCSP avis 2020 §2.10 (l.620 of the PDF):

> "œufs crus et produits à base d'œufs crus ou insuffisamment cuits ne doivent pas être consommés (enfants de 0 à 3 ans)"

Should be `< 3 ans`, not `< 12 mois`. The 12-mo gate implies it's safe at 1 yr, which contradicts HCSP.

### 3. Tofu age conflicts with soja FORBIDDEN_FOOD

**Files:** `src/lib/server/db/seed.ts:79` (Tofu, suggestedAgeMonths: 6) vs `src/lib/content/guidance.ts:683` (`FORBIDDEN_FOODS[sojaboisson-3ans]`, `until: '< 3 ans'`)

HCSP §1.4 + §2.6 + l.793: soja products discouraged before 3 ans (phyto-œstrogènes + ANSES 2016c). The "sojaboisson-3ans" entry is correct; tofu seeded at 6 mo contradicts it. SpF parent brochure (l.419) is explicit: *"Le « lait » de soja et tous les produits à base de soja"* — discouraged under 3.

**Fix shape:** raise Tofu's `suggestedAgeMonths` to 36, or add a `notes` caveat acknowledging the soja restriction. Cross-check `ALLERGEN_GUIDANCE.soja` (`guidance.ts:347-352`) which currently recommends tofu at 6 mo — same fix.

### 4. "12 allergens per HCSP-2020" attribution is wrong

**File:** `src/lib/utils/allergens.ts:1-11`

The header comment says "12 priority allergens for early-introduction guidance per the HCSP-2020 avis". HCSP §1.2.2 names only `produits laitiers / œuf / arachide` explicitly as priority introduction allergens (the rest of HCSP's allergen content is risk-management, not introduction-priority). The "12" matches **EU Regulation 1169/2011 Annexe II minus lupin and sulphites** — a *food labelling* list, not an introduction-priority list.

**Fix shape:** either (a) rewrite the comment to attribute to EU 1169/2011 (which is the actual source); or (b) rebrand the list as "the 12 allergens the app tracks for diversification logging" without claiming HCSP authorship. Cascading consequence: every UI string referencing "12 allergènes prioritaires" would benefit from a similar attribution rephrase (`milestones.ts:48`, `allergens.ts:1` comment, several SEO/landing/guide strings).

### 5. Egg portion contradiction

**Files:** `src/lib/content/guidance.ts:73` (focus, 6–9 mo) vs `:240` (`ALLERGEN_GUIDANCE.oeuf.howToOffer`)

- `:73`: "Œuf entier bien cuit, jaune et blanc, ~1/4 puis 1/2."
- `:240`: "1/4 de jaune écrasé … puis 1/2, puis l'œuf entier"

HCSP §2.7:

> "L'œuf doit être consommé cuit (dur) : ¼ d'œuf entre 6 et 12 mois, 1/3 de 1 à 2 ans, puis 1/2 de 2 à 3 ans"

Two issues:
- `:240` says "1/4 de jaune" (yolk only) — HCSP says whole egg (jaune+blanc) from start.
- Both strings skip the 1/3 step at 1–2 yr.

**Fix shape:** align both to the HCSP staircase ¼ → 1/3 → 1/2, with whole egg from start.

### 6. Walnut oil mistranslated as "knob of butter"

**File:** `src/lib/content/guidance.ts:69`

App's 6–9 mo focus says "Toujours ajouter des matières grasses crues à la fin de la cuisson (huile de colza, huile d'olive, noix de beurre)."

HCSP §2.9 (l.869):

> "Privilégier les huiles de colza et de noix (riches en ALA) et l'huile d'olive, par rapport aux huiles pauvres en ALA (tournesol, arachide)"

"Huile de noix" = walnut oil (ALA-rich, the rationale for HCSP's recommendation). "Noix de beurre" in French = a knob/pat of butter — a *saturated* fat. Two different recommendations got conflated. HCSP §2.9 also adds:

> "Les matières grasses animales [beurre] sont à réserver à un usage cru ou tartinable et en quantité limitée"

i.e. butter is allowed but in *limited* quantity, not interchangeable with walnut oil.

**Fix shape:** "(huile de colza, huile de noix, huile d'olive ; beurre cru en petite quantité possible)".

### 7. Céleri in "viennent plus tard" list (PR #52 regression)

**File:** the closed PR #52 branch had `src/lib/content/guidance.ts:74` saying "Crustacés, mollusques, **céleri** et moutarde viennent plus tard". But `ALLERGEN_GUIDANCE.celeri` sets `recommendedAgeMonths: 6`. Internal contradiction — same class as the original Codex P2.

**Fix shape:** if PR #52 is reopened or its content is folded into a comprehensive PR, list céleri among the principal allergens (8 → 9), and the deferred list becomes "Crustacés, mollusques et moutarde viennent plus tard" (4 → 3). 9 + 3 = 12.

---

## Editorial / domain-judgment items (detail)

These items show the app diverging from cited authoritative sources, but the app's stance may be intentionally conservative or based on supplementary sources (SFP, ANSES nourrissons, AAP). Owner judgment required.

### A. Allergen `recommendedAgeMonths: 6`

`ALLERGEN_GUIDANCE` for oeuf, arachide, lait, gluten, fruits_a_coque, sesame, soja, poisson all set `recommendedAgeMonths: 6`. HCSP avis 2020 §1.2.1 + §1.2.2 + Annexe 1 explicitly allows introduction *from start of diversification*, i.e. 4 mo. ESPGHAN 2017: "any time after 4 months". The app's 6-mo gate is conservative — defensible as "most common French practice" but creates a 2-month window where parents who follow per-card guidance may push past HCSP's "pas après 6 mois révolus" warning.

**Defensible if intentional**; if not, lower to 4. Same change should propagate to the seed catalog (`seed.ts` for cabillaud/saumon/poulet/bœuf/pâtes/lentilles/comté etc.).

### B. Meat / fish / egg grammage table

App: "10–20 g/j à 6 mo, ~30 g/j à 1 an, jusqu'à 50 g vers 3 ans" (`guidance.ts:72, 130, 476`).

HCSP §2.7:
> "10 g/j de 6 à 12 mois, 20 g/j de 1 à 2 ans, 30 g/j de 2 à 3 ans"

The app figures are 50% higher than HCSP at the upper end. The "50 g vers 3 ans" has no HCSP basis. ESPGHAN provides per-kg-protein guidance that gives slightly higher numbers, so the app's stance may be ESPGHAN-derived; if so, the citation should be ESPGHAN, not HCSP / SpF.

### C. Milk floor 4–6 mo

App: "~600–800 mL/jour" (`guidance.ts:41, 51`). HCSP §2.1: "minimum 500 mL/j, sans dépasser 800 mL/j". The 600 floor is 100 mL above HCSP. Stage 6–9 (`:79`) drops to 500 mL — internally inconsistent with the 4–6 mo number.

### D. Choking-hazard ages

App: 4 yr (raisin, carotte crue) / 5 yr (fruits à coque entiers, pop-corn, chewing-gum). HCSP §1.4: 3 yr. SFP/AAP convention: 4–5 yr. The app's stance is the SFP/AAP-style conservative one; defensible but misattributed to HCSP if cited as such.

### E. Crustacé / mollusque / moutarde / céleri ages

`ALLERGEN_GUIDANCE.crustace.recommendedAgeMonths = 12`, `mollusque = 12`, `moutarde = 9`, `celeri = 6`. None of these specific numbers traces to HCSP / SpF / ANSES. They're app-policy. If kept, the citation should say so explicitly.

### F. Légumineuses cadence

App: "1–2 fois par semaine" (`guidance.ts:468`). HCSP §2.4: "le repère après un an d'au moins 2 fois par semaine". Should be `≥ 2/sem après 1 an`.

### G. Salt framing

`FORBIDDEN_FOODS[sel].until: '< 12 mois'` (`guidance.ts:631`) and `KEY_PRINCIPLES[no-added-salt]` use a "<1 g/jour" gram figure. HCSP §2.10 has no age cliff and no per-day gram limit — the message is "limit always" through 36 mo. The "<12 mois" framing implies salt is OK after 1 yr.

### H. EAT study `/3` framing

`guidance.ts:954` and `GuideStaticSections.svelte:165` claim early multi-allergen introduction "divise par 3" the allergy risk per the EAT study. EAT (NEJM 2016) per-protocol analysis showed reductions; intention-to-treat was non-significant. The headline phrasing is loose.

### I. LEAP / EAT for "4–6 mois"

`routes/+page.svelte:27` says LEAP and EAT support "dès 4–6 mois". LEAP used 4–11 mo for arachide; EAT used 3–4 mo. Conflating both as "4–6 mois" is misattribution.

---

## Confirmed correct (independently re-verified)

These claims were re-checked against primary sources and are accurate:

- 4–6 mo diversification window: "pas avant 4, pas après 6" (HCSP §1.2.1) ✓
- Honey `< 12 mois` (HCSP, WHO, ANSES — botulisme infantile) ✓
- Cow's milk as main drink not before 1 yr (HCSP, ESPGHAN) ✓
- Plant beverages don't replace formula `< 1 an` (HCSP §1.2.3) ✓
- Raw-milk soft cheeses `< 5 ans` (ANSES) ✓
- Mercure / espadon-requin-marlin (ANSES) ✓
- Fish 2×/sem dont un gras (HCSP §2.7) ✓
- Anaphylaxis → SAMU 15 (correct French emergency number) ✓
- Choking cuts: raisin/tomate cerise en 4 (AAP/SFP convention) ✓
- LEAP "86%" peanut allergy reduction in high-risk infants (NEJM 2015) ✓
- Gluten 4–12 mo window (HCSP §2.6, ESPGHAN 2017) ✓
- ESPGHAN 2017 retraction of breastfeeding-at-gluten-introduction protection ✓
- DME / SFP 2022 position summary ✓
- ReactionPicker labels (RAS / inconfort / réaction) ✓

---

## Recommended next steps

1. **Walk the 7 clear-cut bugs together** — owner approves each fix individually before any change ships. Some require small wording calls (e.g. how to rebrand "12 allergens").
2. **Per-item domain decisions for the 9 editorial items** — each is a "do you want to align with HCSP or keep the conservative app stance?" question.
3. **Prefer one comprehensive PR over many small ones**, given the cross-file consistency requirements (changing allergen ages affects guidance.ts + seed.ts + tests; changing the "12 allergens" attribution affects 6+ files).
4. **Add a short medical-content review checklist to the repo** so future content changes go through this same primary-source verification.

This document does not propose fixes. It surfaces the discrepancies and lets the owner decide what to act on.
