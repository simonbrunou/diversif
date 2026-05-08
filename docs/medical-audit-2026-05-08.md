# Medical-content audit — 2026-05-08

> **What this is:** an automated multi-agent audit of every medical / nutritional claim shipped in the diversif app, cross-referenced against the cited authoritative sources (HCSP 2020, SpF/PNNS 2021, ESPGHAN 2017, ANSES, WHO 2023, LEAP/EAT trials).
>
> **What this is NOT:** medical advice, a rewrite, or a green-light list. Several findings flag conservative app-policy choices that may be intentional. Owner / domain expert decides what to act on.
>
> **Why this exists:** an earlier "8 drift items" pass (2026-05-07) shipped a partial fix that introduced two successive internal contradictions (caught by Codex, then by the re-audit). The user lost confidence and asked for a thorough re-derivation from primary sources. This document is the result of three independent agents: PR-diff verification, age-claim audit, and quantity-claim audit.

## TL;DR

**Clear-cut bugs** (code or attribution wrong, no domain judgment needed):

1. 🚨 **`oeuf-cru` blocked `< 12 mois`** (`guidance.ts:647`) and tip `egg-fully-cooked` (`:860`) — HCSP says 0–3 ans for raw eggs / mayo maison.
2. 🚨 **`allergens.ts:1` comment claims "12 priority allergens per the HCSP-2020 avis"** — HCSP names only `produits laitiers / œuf / arachide` explicitly. The 12 = **EU Regulation 1169/2011 minus lupin and sulphites** (a _labelling_ list, not an introduction list).
3. 🚨 **Egg portion contradiction**: `oeuf.howToOffer` (`guidance.ts:240`) says "1/4 de **jaune**" (yolk only), focus text (`:73`) says "œuf entier ~1/4 puis 1/2", HCSP §2.7 says "œuf entier (jaune+blanc), ¼ entre 6–12 mois, 1/3 entre 1–2 ans, 1/2 entre 2–3 ans". App skips the 1/3 step and contradicts itself on yolk vs whole.
4. 🚨 **"Noix de beurre" translation bug** (`guidance.ts:69`): HCSP §2.9 highlights _huile de colza_ and _huile de noix_ (walnut oil, ALA-rich). App lists "huile de colza, huile d'olive, **noix de beurre**" — "noix de beurre" means _a knob of butter_, a different fat with different rationale.

**Audit findings that did NOT hold up under verification** (kept here for transparency, not actionable):

- ❌ **Milestone "Les 12 allergènes prioritaires" toast can never fire.** Agent B claimed this. On code re-read, `priorAllergenCount` is filtered by `eq(foods.allergenType, food.allergenType)` (line 158 of `+page.server.ts`) — it counts entries for _this specific allergen type_, not total. The toast fires correctly when the 12th distinct allergen is first logged. Audit was wrong.
- ❌ **Céleri in "viennent plus tard" list.** This contradiction only existed inside the closed PR #52 branch (commit `7c4fda6`), not in shipped code. Listing it here as a current bug overstates the audit; current `guidance.ts:74` is the original "12 prioritaires (8 listed)" sentence, which is the underlying inconsistency, not a céleri-specific one.

**Editorial / domain-judgment items** (where authoritative sources differ from the app, and the app's stance may be intentionally conservative):

- **Soja: app picks ESPGHAN-permissive, not HCSP/ANSES-conservative.** Tofu seeded at 6 mo, soja card sources `['espghan-2017']` only, FORBIDDEN_FOODS[sojaboisson-3ans] restricts only regular consumption with a "tofu en petite quantité reste possible" caveat — internally consistent app policy, but at odds with HCSP §1.4 + §2.6 and ANSES NUT2017SA0145, which discourage soja products as a class before 3 ans. Owner judgment: align with HCSP/ANSES (defensible French stance) or stay with ESPGHAN (defensible international evidence-based stance), but document the choice on the soja card.
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

### 1. `oeuf-cru` and `egg-fully-cooked` use the wrong age cliff

**Files:** `src/lib/content/guidance.ts:647` and `:860`

App says "œufs crus / mayo maison: avant 12 mois". HCSP avis 2020 §2.10 (l.620 of the PDF):

> "œufs crus et produits à base d'œufs crus ou insuffisamment cuits ne doivent pas être consommés (enfants de 0 à 3 ans)"

Should be `< 3 ans`, not `< 12 mois`. The 12-mo gate implies it's safe at 1 yr, which contradicts HCSP.

### 2. "12 allergens per HCSP-2020" attribution is wrong

**File:** `src/lib/utils/allergens.ts:1-11`

The header comment says "12 priority allergens for early-introduction guidance per the HCSP-2020 avis". HCSP §1.2.2 names only `produits laitiers / œuf / arachide` explicitly as priority introduction allergens (the rest of HCSP's allergen content is risk-management, not introduction-priority). The "12" matches **EU Regulation 1169/2011 Annexe II minus lupin and sulphites** — a _food labelling_ list, not an introduction-priority list.

**Fix shape:** either (a) rewrite the comment to attribute to EU 1169/2011 (which is the actual source); or (b) rebrand the list as "the 12 allergens the app tracks for diversification logging" without claiming HCSP authorship. Cascading consequence: every UI string referencing "12 allergènes prioritaires" would benefit from a similar attribution rephrase (`milestones.ts:48`, `allergens.ts:1` comment, several SEO/landing/guide strings).

### 3. Egg portion contradiction

**Files:** `src/lib/content/guidance.ts:73` (focus, 6–9 mo) vs `:240` (`ALLERGEN_GUIDANCE.oeuf.howToOffer`)

- `:73`: "Œuf entier bien cuit, jaune et blanc, ~1/4 puis 1/2."
- `:240`: "1/4 de jaune écrasé … puis 1/2, puis l'œuf entier"

HCSP §2.7:

> "L'œuf doit être consommé cuit (dur) : ¼ d'œuf entre 6 et 12 mois, 1/3 de 1 à 2 ans, puis 1/2 de 2 à 3 ans"

Two issues:

- `:240` says "1/4 de jaune" (yolk only) — HCSP says whole egg (jaune+blanc) from start.
- Both strings skip the 1/3 step at 1–2 yr.

**Fix shape:** align both to the HCSP staircase ¼ → 1/3 → 1/2, with whole egg from start.

### 4. Walnut oil mistranslated as "knob of butter"

**File:** `src/lib/content/guidance.ts:69`

App's 6–9 mo focus says "Toujours ajouter des matières grasses crues à la fin de la cuisson (huile de colza, huile d'olive, noix de beurre)."

HCSP §2.9 (l.869):

> "Privilégier les huiles de colza et de noix (riches en ALA) et l'huile d'olive, par rapport aux huiles pauvres en ALA (tournesol, arachide)"

"Huile de noix" = walnut oil (ALA-rich, the rationale for HCSP's recommendation). "Noix de beurre" in French = a knob/pat of butter — a _saturated_ fat. Two different recommendations got conflated. HCSP §2.9 also adds:

> "Les matières grasses animales [beurre] sont à réserver à un usage cru ou tartinable et en quantité limitée"

i.e. butter is allowed but in _limited_ quantity, not interchangeable with walnut oil.

**Fix shape:** "(huile de colza, huile de noix, huile d'olive ; beurre cru en petite quantité possible)".

---

## Audit findings that did NOT hold up under verification (detail)

These two items appeared in the initial multi-agent output but failed code-level re-verification. They are kept here for transparency, not as actionable bugs.

### Milestone "all 12 allergens" toast (Agent B claim — wrong)

**File:** `src/routes/child/[id]/log/+page.server.ts:194-195`

```ts
const isFirstAllergen = priorAllergenCount === 0 && food.allergenType != null;
const allAllergensJustCompleted =
  isFirstAllergen && priorAllergensIntroduced + 1 === ALLERGENS.length;
```

Agent B claimed `isFirstAllergen` requires "the first allergen ever logged" — implying the toast can never fire. Re-reading the actual code shows `priorAllergenCount` is filtered by `eq(foods.allergenType, food.allergenType)` (line 158) — it counts entries for _this specific allergen type_, not the child's total allergen entries. So `isFirstAllergen` correctly means "this is the first time this particular allergen is being introduced", and the toast fires when introducing the 12th distinct allergen for the first time. Audit was wrong; logic is correct.

### Céleri in "viennent plus tard" (only existed inside closed PR #52)

The contradiction "Crustacés, mollusques, **céleri** et moutarde viennent plus tard" only appeared inside the closed PR #52 branch (commit `7c4fda6`), not in shipped code. Listing it as a current bug overstates the audit; current `guidance.ts:74` is the original "12 prioritaires (8 listed)" sentence. The underlying inconsistency (the "8 listed" are framed as priorities while ALLERGENS has 12 entries) is the attribution issue captured in clear-cut bug #2, not a céleri-specific defect.

---

## Editorial / domain-judgment items (detail)

These items show the app diverging from cited authoritative sources, but the app's stance may be intentionally conservative or based on supplementary sources (SFP, ANSES nourrissons, AAP). Owner judgment required.

### A. Soja: ESPGHAN-permissive vs HCSP/ANSES-conservative

**Files:** `src/lib/server/db/seed.ts:79` (Tofu, suggestedAgeMonths: 6); `src/lib/content/guidance.ts:345-356` (`ALLERGEN_GUIDANCE.soja`, `recommendedAgeMonths: 6`, `sources: ['espghan-2017']`); `src/lib/content/guidance.ts:683` (`FORBIDDEN_FOODS[sojaboisson-3ans]`, `until: '< 3 ans (consommation régulière)'`, caveat _"Le tofu en petite quantité reste possible"_, `sources: ['anses-nourrisson']`).

The three sites are internally consistent — they collectively say "tofu in small quantity at 6 mo is acceptable, regular soja consumption is discouraged before 3 ans." That's an ESPGHAN-aligned stance (ESPGHAN 2017 doesn't single soja out for early restriction).

HCSP §1.4 + §2.6 + l.793 and ANSES NUT2017SA0145 are stricter: soja products as a class are discouraged before 3 ans (phyto-œstrogènes), with no "small quantity" carve-out. SpF parent brochure (l.419) is explicit: _"Le « lait » de soja et tous les produits à base de soja"_ — discouraged under 3.

**Owner judgment required.** Both stances are defensible:

- **HCSP/ANSES-aligned (conservative French stance):** raise Tofu's `suggestedAgeMonths` to 36, drop the "petite quantité possible" caveat from FORBIDDEN_FOODS, rewrite `ALLERGEN_GUIDANCE.soja` to defer to 3 ans, swap sources to `['hcsp-2020', 'anses-nourrisson']`. Surface this in the soja card so parents know.
- **ESPGHAN-aligned (international evidence-based stance):** keep current data, but document on the soja card that this is an explicit ESPGHAN-over-HCSP choice.

The current code does the second implicitly. Either path is fine; the audit's only ask is that the soja card's framing match the chosen stance.

### B. Allergen `recommendedAgeMonths: 6`

`ALLERGEN_GUIDANCE` for oeuf, arachide, lait, gluten, fruits*a_coque, sesame, soja, poisson all set `recommendedAgeMonths: 6`. HCSP avis 2020 §1.2.1 + §1.2.2 + Annexe 1 explicitly allows introduction \_from start of diversification*, i.e. 4 mo. ESPGHAN 2017: "any time after 4 months". The app's 6-mo gate is conservative — defensible as "most common French practice" but creates a 2-month window where parents who follow per-card guidance may push past HCSP's "pas après 6 mois révolus" warning.

**Defensible if intentional**; if not, lower to 4. Same change should propagate to the seed catalog (`seed.ts` for cabillaud/saumon/poulet/bœuf/pâtes/lentilles/comté etc.).

### C. Meat / fish / egg grammage table

App: "10–20 g/j à 6 mo, ~30 g/j à 1 an, jusqu'à 50 g vers 3 ans" (`guidance.ts:72, 130, 476`).

HCSP §2.7:

> "10 g/j de 6 à 12 mois, 20 g/j de 1 à 2 ans, 30 g/j de 2 à 3 ans"

The app figures are 50% higher than HCSP at the upper end. The "50 g vers 3 ans" has no HCSP basis. ESPGHAN provides per-kg-protein guidance that gives slightly higher numbers, so the app's stance may be ESPGHAN-derived; if so, the citation should be ESPGHAN, not HCSP / SpF.

### D. Milk floor 4–6 mo

App: "~600–800 mL/jour" (`guidance.ts:41, 51`). HCSP §2.1: "minimum 500 mL/j, sans dépasser 800 mL/j". The 600 floor is 100 mL above HCSP. Stage 6–9 (`:79`) drops to 500 mL — internally inconsistent with the 4–6 mo number.

### E. Choking-hazard ages

App: 4 yr (raisin, carotte crue) / 5 yr (fruits à coque entiers, pop-corn, chewing-gum). HCSP §1.4: 3 yr. SFP/AAP convention: 4–5 yr. The app's stance is the SFP/AAP-style conservative one; defensible but misattributed to HCSP if cited as such.

### F. Crustacé / mollusque / moutarde / céleri ages

`ALLERGEN_GUIDANCE.crustace.recommendedAgeMonths = 12`, `mollusque = 12`, `moutarde = 9`, `celeri = 6`. None of these specific numbers traces to HCSP / SpF / ANSES. They're app-policy. If kept, the citation should say so explicitly.

### G. Légumineuses cadence

App: "1–2 fois par semaine" (`guidance.ts:468`). HCSP §2.4: "le repère après un an d'au moins 2 fois par semaine". Should be `≥ 2/sem après 1 an`.

### H. Salt framing

`FORBIDDEN_FOODS[sel].until: '< 12 mois'` (`guidance.ts:631`) and `KEY_PRINCIPLES[no-added-salt]` use a "<1 g/jour" gram figure. HCSP §2.10 has no age cliff and no per-day gram limit — the message is "limit always" through 36 mo. The "<12 mois" framing implies salt is OK after 1 yr.

### I. EAT study `/3` framing

`guidance.ts:954` and `GuideStaticSections.svelte:165` claim early multi-allergen introduction "divise par 3" the allergy risk per the EAT study. EAT (NEJM 2016) per-protocol analysis showed reductions; intention-to-treat was non-significant. The headline phrasing is loose.

### J. LEAP / EAT for "4–6 mois"

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
