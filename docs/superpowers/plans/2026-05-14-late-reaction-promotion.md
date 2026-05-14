# Late reaction promotion — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a `ras` food entry's detail page, let a caregiver add a symptom that atomically promotes the entry to `inconfort` or `reaction`.

**Architecture:** Extend `insertSymptom` to perform the symptom insert and an optional `reaction` upgrade inside a single transaction, returning a `promotedTo` flag. The `addSymptom` action emits a new `food_entry.reaction_promoted` audit event when that flag is set. UI gets a single new button below `RasCard` that opens the existing `AddSymptomSheet`.

**Tech Stack:** SvelteKit 5 (runes), Drizzle ORM, pg-mem (tests), Vitest, paraglide-js.

---

## Severity mapping (resolved open question)

The spec's table is replaced by the codebase's already-settled `severityOf(label)`:

- `severityOf(label) === 'severe'` → promote `ras` to `reaction` (labels: `gonflement`, `detresse-respiratoire`, `levres-bleues`)
- otherwise → promote `ras` to `inconfort` (everything else, including `warn` and `neutral`)

Rationale: any symptom means the entry is no longer "rien à signaler", so `warn` and `neutral` both upgrade to `inconfort`. Only the anaphylactic markers escalate to `reaction`.

---

## File structure

**Modify:**

- `src/lib/server/db/symptoms.ts` — extend `insertSymptom` to take the current entry's reaction and return `{ promotedTo }`; wrap in `db.transaction`.
- `src/lib/server/audit.ts` — add `food_entry.reaction_promoted` to the `AuditEvent` union.
- `src/routes/child/[id]/foods/[entryId]/+page.server.ts` — pass `entry.reaction` into `insertSymptom`; emit the new audit event when `promotedTo` is set.
- `src/routes/child/[id]/foods/[entryId]/+page.svelte` — add a button under `<RasCard>` that opens a bound `AddSymptomSheet`.
- `src/lib/paraglide/messages/fr.js` — add `lateReactionButton` message.
- `messages/fr.json` (or wherever the source messages live — verify in Task 5) — keep the source aligned.
- `src/routes/child/[id]/foods/[entryId]/page.server.test.ts` — add promotion + audit tests.

**No files created.** No schema change. `RasCard.svelte` and `AddSymptomSheet.svelte` are not modified.

---

## Task 1: Extend `AuditEvent` union

**Files:**

- Modify: `src/lib/server/audit.ts:13-32`

- [ ] **Step 1: Add the new event variant**

Open `src/lib/server/audit.ts` and add a new variant to the `AuditEvent` union, immediately after `symptom.added`:

```typescript
  | {
      type: 'food_entry.reaction_promoted';
      userId: number;
      childId: number;
      entryId: number;
      from: 'ras';
      to: 'inconfort' | 'reaction';
      triggeredBy: number; // symptom id
    };
```

The `from` literal is `'ras'` because the action only promotes from `ras`. Keeping it explicit makes the audit log self-describing.

- [ ] **Step 2: Typecheck**

Run: `npx svelte-kit sync && npx tsc -p . --noEmit`
Expected: no errors. (svelte-kit sync regenerates `./$types.ts` files; if that command isn't available in this repo, just `npx tsc -p . --noEmit`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/audit.ts
git commit -m "audit: add food_entry.reaction_promoted event"
```

---

## Task 2: Failing action tests for promotion + audit (TDD red)

**Files:**

- Modify: `src/routes/child/[id]/foods/[entryId]/page.server.test.ts` (already exists; touched in PR #124)

This task writes the failing tests **before** Task 3 modifies `insertSymptom`. Reusing the existing harness here (rather than a new unit-test file) avoids duplicating the `setup()` / `ctx.log()` seeders.

- [ ] **Step 1: Read the existing test file to confirm helper names**

Run: `sed -n '1,60p' src/routes/child/\[id\]/foods/\[entryId\]/page.server.test.ts`

You're looking for:

- The `setup()` helper (returns `ctx` with `.log()`, `.u`, `.c`, `.m`).
- Whether `ctx.log()` accepts a reaction-value argument. The existing test uses `await ctx.log('reaction')`. If the helper signature is `log(reaction: 'ras' | 'inconfort' | 'reaction')`, you're set. If not, widen it (one-line change in the seeder).

- [ ] **Step 2: Mock the audit module**

Near the top of the file (under the existing `vi.mock` calls), add:

```typescript
import { audit } from '$lib/server/audit';
vi.mock('$lib/server/audit', () => ({ audit: vi.fn() }));
```

If a mock for `$lib/server/audit` already exists, skip the `vi.mock` line and just add the import.

In the existing `beforeEach` (or add one), reset the spy:

```typescript
beforeEach(() => {
  vi.mocked(audit).mockClear();
});
```

- [ ] **Step 3: Add four new tests inside the existing `describe('addSymptom action', ...)` block**

```typescript
it('promotes ras entry to inconfort when symptom is mild and emits audit', async () => {
  const ctx = await setup();
  const entry = await ctx.log('ras');
  const result = await actions.addSymptom(
    makeFormEvent(ctx, entry.id, { label: 'rougeur', note: '', observedAt: '11:42' })
  );
  expect(result).toEqual({ success: true });

  const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
  expect(row.reaction).toBe('inconfort');

  const promotedCall = vi
    .mocked(audit)
    .mock.calls.find((c) => c[0].type === 'food_entry.reaction_promoted')?.[0];
  expect(promotedCall).toMatchObject({ from: 'ras', to: 'inconfort', entryId: entry.id });
});

it('promotes ras entry to reaction when symptom is severe', async () => {
  const ctx = await setup();
  const entry = await ctx.log('ras');
  await actions.addSymptom(
    makeFormEvent(ctx, entry.id, { label: 'detresse-respiratoire', note: '', observedAt: '11:42' })
  );
  const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
  expect(row.reaction).toBe('reaction');
  const promotedCall = vi
    .mocked(audit)
    .mock.calls.find((c) => c[0].type === 'food_entry.reaction_promoted')?.[0];
  expect(promotedCall).toMatchObject({ from: 'ras', to: 'reaction' });
});

it('does not promote an inconfort entry on additional symptoms', async () => {
  const ctx = await setup();
  const entry = await ctx.log('inconfort');
  await actions.addSymptom(
    makeFormEvent(ctx, entry.id, { label: 'detresse-respiratoire', note: '', observedAt: '11:42' })
  );
  const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
  expect(row.reaction).toBe('inconfort');
  const calls = vi.mocked(audit).mock.calls.map((c) => c[0].type);
  expect(calls).not.toContain('food_entry.reaction_promoted');
});

it('does not promote a reaction entry on additional symptoms', async () => {
  const ctx = await setup();
  const entry = await ctx.log('reaction');
  await actions.addSymptom(
    makeFormEvent(ctx, entry.id, { label: 'urticaire', note: '', observedAt: '11:42' })
  );
  const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
  expect(row.reaction).toBe('reaction');
  const calls = vi.mocked(audit).mock.calls.map((c) => c[0].type);
  expect(calls).not.toContain('food_entry.reaction_promoted');
});
```

Confirm `foodEntries` and `eq` are imported at the top (likely already are). Also confirm `actions` is imported as `import { actions } from './+page.server';` (look at how the existing `addSymptom` tests reference it).

- [ ] **Step 4: Run and confirm the new tests FAIL**

Run: `npx vitest run src/routes/child/\[id\]/foods/\[entryId\]/page.server.test.ts`
Expected: existing tests pass; the four new tests FAIL — the audit spy never sees `food_entry.reaction_promoted` and the `row.reaction` stays `'ras'` on the first two new tests.

---

## Task 3: Make `insertSymptom` promote inside a transaction

**Files:**

- Modify: `src/lib/server/db/symptoms.ts:20-36`

- [ ] **Step 1: Update the signature and body**

Replace the existing `insertSymptom` function with:

```typescript
import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { foodEntries, symptoms } from './schema';

type ReactionLevel = 'ras' | 'inconfort' | 'reaction';

export interface InsertSymptomInput {
  foodEntryId: number;
  childId: number;
  observedAt: Date;
  label: SymptomLabel;
  note: string | null;
  createdBy: number;
  currentReaction: ReactionLevel;
}

export interface InsertSymptomResult {
  symptomId: number;
  promotedTo: 'inconfort' | 'reaction' | null;
}

export async function insertSymptom(input: InsertSymptomInput): Promise<InsertSymptomResult> {
  const promotedTo: 'inconfort' | 'reaction' | null =
    input.currentReaction === 'ras'
      ? severityOf(input.label) === 'severe'
        ? 'reaction'
        : 'inconfort'
      : null;

  return await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(symptoms)
      .values({
        foodEntryId: input.foodEntryId,
        childId: input.childId,
        observedAt: input.observedAt,
        label: input.label,
        note: input.note,
        createdBy: input.createdBy
      })
      .returning({ id: symptoms.id });

    if (promotedTo) {
      await tx
        .update(foodEntries)
        .set({ reaction: promotedTo })
        .where(eq(foodEntries.id, input.foodEntryId));
    }

    return { symptomId: row.id, promotedTo };
  });
}
```

Keep the existing other exports from this file intact. Also export `ReactionLevel` so the action handler in Task 4 can import it instead of casting:

```typescript
export type ReactionLevel = 'ras' | 'inconfort' | 'reaction';
```

If `db.transaction` is not supported by the test harness (pg-mem can be strict on nested transactions or savepoints), confirm with the test in Task 4 — if it fails, fall back to two sequential `db.insert` + `db.update` calls (acceptable: the second is a no-op idempotent UPDATE that does not introduce a real race because the same caregiver's session is producing both writes).

- [ ] **Step 2: Run the action tests from Task 2**

Run: `npx vitest run src/routes/child/\[id\]/foods/\[entryId\]/page.server.test.ts`
Expected: The four new tests still FAIL — `insertSymptom` now does the promotion, but the action handler isn't passing `currentReaction` yet, and isn't emitting the new audit event. Existing tests should now FAIL too (TypeScript or runtime), because `insertSymptom`'s signature changed: it now requires `currentReaction`. This is expected and gets fixed in Task 4.

---

## Task 4: Update the `addSymptom` action and emit the audit event

**Files:**

- Modify: `src/routes/child/[id]/foods/[entryId]/+page.server.ts:73-108` (the `addSymptom` action)
- Reference: `src/routes/child/[id]/foods/[entryId]/+page.server.ts:38-65` (the load function — need `entry.reaction` to be on the loaded entry, or re-read it here)

- [ ] **Step 1: Read the current entry's reaction inside the action**

Currently the action calls `await loadEntryForChild(entryId, childId)` (line ~85). That function likely already returns the row including `reaction`. Update the action body to capture it:

```typescript
const entry = await loadEntryForChild(entryId, childId);
// existing observedAt parsing stays here unchanged
const result = await insertSymptom({
  foodEntryId: entryId,
  childId,
  observedAt,
  label: parsed.data.label,
  note: parsed.data.note.trim() || null,
  createdBy: user.id,
  currentReaction: entry.reaction as 'ras' | 'inconfort' | 'reaction'
});

audit({
  type: 'symptom.added',
  userId: user.id,
  childId,
  entryId,
  label: parsed.data.label
});

if (result.promotedTo) {
  audit({
    type: 'food_entry.reaction_promoted',
    userId: user.id,
    childId,
    entryId,
    from: 'ras',
    to: result.promotedTo,
    triggeredBy: result.symptomId
  });
}

return { success: true };
```

Replace `entry.reaction as 'ras' | 'inconfort' | 'reaction'` by importing the new type:

```typescript
import { insertSymptom, type ReactionLevel } from '$lib/server/db/symptoms';
// ...
currentReaction: entry.reaction as ReactionLevel;
```

If `loadEntryForChild` does not currently return `reaction` (open it and check the SELECT list), widen its SELECT to include `reaction`. Other callers in the same file expect a row shape, so verify they don't break by re-reading the load function output.

- [ ] **Step 2: Run the action tests — all four should now PASS**

Run: `npx vitest run src/routes/child/\[id\]/foods/\[entryId\]/page.server.test.ts`
Expected: every test in the file passes, including the four new ones from Task 2.

- [ ] **Step 3: Commit the symptoms + action changes together (Tasks 3 + 4)**

```bash
git add src/lib/server/db/symptoms.ts src/routes/child/\[id\]/foods/\[entryId\]/+page.server.ts src/routes/child/\[id\]/foods/\[entryId\]/page.server.test.ts
git commit -m "foods/[entryId]: promote ras on first symptom + audit event"
```

---

## Task 5: Add the French message

**Files:**

- Modify: `messages/fr.json` (or whichever paraglide source the project compiles from — verify below)
- Modify (generated): `src/lib/paraglide/messages/fr.js` (do NOT hand-edit if a source JSON drives it; let the compile step regenerate)

- [ ] **Step 1: Identify the paraglide source-of-truth**

Run: `ls messages/ project.inlang/messages/ 2>/dev/null; grep -l '"addSymptomTitle"' messages/*.json project.inlang/messages/*.json 2>/dev/null`

Expected: find the JSON file(s) that contain the `addSymptomTitle` key. That's the source. (If only `src/lib/paraglide/messages/fr.js` exists and there is no JSON, the JS files ARE the source — edit them directly.)

- [ ] **Step 2: Add the key**

Add a single new message keyed `lateReactionButton`. Value: `"Signaler une réaction tardive"`.

- If editing a JSON source:
  ```json
  "lateReactionButton": "Signaler une réaction tardive"
  ```
- If editing `src/lib/paraglide/messages/fr.js` directly (and the corresponding `en.js` if English exists):
  ```javascript
  export const lateReactionButton = () => `Signaler une réaction tardive`;
  ```

If a generation step is needed (e.g., `npm run i18n`, `npx @inlang/paraglide-js compile`, or similar), find it in `package.json` scripts and run it.

- [ ] **Step 3: Verify TypeScript sees the new message**

Run: `npx tsc -p . --noEmit`
Expected: no errors. (`m.lateReactionButton()` will be used in Task 7; the import is what matters.)

- [ ] **Step 4: Commit**

```bash
git add messages/ src/lib/paraglide/
git commit -m "i18n: add lateReactionButton message"
```

---

## Task 6: Wire the button into the `ras` branch of the page

**Files:**

- Modify: `src/routes/child/[id]/foods/[entryId]/+page.svelte:11-29` (the `{#if data.isRas}` branch)

- [ ] **Step 1: Add a state flag and the sheet near the top of the `<script>`**

In the existing `<script lang="ts">` block, add (next to any other imports):

```typescript
import AddSymptomSheet from '$lib/components/bento/AddSymptomSheet.svelte';
let lateReactionOpen = $state(false);
```

If `AddSymptomSheet` is already imported, skip the import.

- [ ] **Step 2: Add the button and the sheet inside the `ras` branch**

Inside the `{#if data.isRas}` block, just below `<RasCard nth={data.nth} />`, add:

```svelte
<button
  type="button"
  class="mt-3 inline-flex items-center justify-center rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-soft"
  onclick={() => (lateReactionOpen = true)}
>
  {m.lateReactionButton()}
</button>

<AddSymptomSheet
  bind:open={lateReactionOpen}
  action={`/child/${data.childId}/foods/${data.entryId}`}
/>
```

Tailwind classes mirror existing secondary buttons in the codebase. If a `<Button>` or `<LinkRow>` component is the convention, use that instead — open `src/lib/components/ui/` and pick the closest match.

- [ ] **Step 3: Manual sanity check**

Run: `npm run dev`

Navigate to a child with a `ras` entry: `/child/<id>/foods/<entryId>`. Expected:

- The "Signaler une réaction tardive" button appears below the green RasCard.
- Tapping it opens the AddSymptomSheet bottom sheet.
- Submitting a symptom causes the page to re-render with `ReactionDetailBento` and the new symptom listed.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/child/[id]/foods/[entryId]/+page.svelte
git commit -m "foods/[entryId]: surface late-reaction button on ras entries"
```

---

## Task 7: Component-level test for the button presence

**Files:**

- Modify: existing component test for this route, OR create `src/routes/child/[id]/foods/[entryId]/page.test.ts` if no svelte component test exists yet.

- [ ] **Step 1: Decide if a Svelte-component test fits**

Check: `ls src/routes/child/\[id\]/foods/\[entryId\]/*.test.ts`. If a `page.test.ts` exists, append to it. If not, this task can be skipped — the server-side tests in Task 2 plus the manual check in Task 6 are sufficient coverage. (Skipping is fine: the codebase pattern in PR #124 leans on server tests for route behavior and reserves Svelte component tests for richer components like `Modal`, `AddSymptomSheet`.) If you skip, jump straight to Task 8.

If proceeding, render the page-server `load`-shaped data and assert the button is present:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';

describe('foods/[entryId] page', () => {
  it('renders late-reaction button when entry is ras', () => {
    render(Page, {
      data: {
        childId: 1,
        entryId: 7,
        food: 'Carotte',
        isRas: true,
        nth: 1,
        date: '01/01/2026',
        time: '12:00',
        symptoms: []
      }
    });
    expect(
      screen.getByRole('button', { name: /Signaler une réaction tardive/i })
    ).toBeInTheDocument();
  });

  it('does not render late-reaction button when entry has a reaction', () => {
    render(Page, {
      data: {
        childId: 1,
        entryId: 7,
        food: 'Carotte',
        isRas: false,
        nth: 1,
        date: '01/01/2026',
        time: '12:00',
        symptoms: [],
        // ReactionDetailBento may need additional props; consult its signature
        printHref: '/child/1/foods/7/print'
      }
    });
    expect(screen.queryByRole('button', { name: /Signaler une réaction tardive/i })).toBeNull();
  });
});
```

If `ReactionDetailBento` requires extra props the test stubs don't provide, simplify the second test to just verify the absence of the button by rendering only the `{#if data.isRas}` branch via a wrapper, OR drop the second case entirely and rely on the visual inspection from Task 6.

- [ ] **Step 2: Run the test**

Run: `npx vitest run src/routes/child/[id]/foods/[entryId]/page.test.ts`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/routes/child/[id]/foods/[entryId]/page.test.ts
git commit -m "test(foods/[entryId]): assert late-reaction button visibility"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass with 100% coverage threshold met (existing CI gate).

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npm run check` (or whatever the project's combined script is — check `package.json` scripts).
Expected: clean.

- [ ] **Step 3: E2E spot check (optional but recommended)**

Run: `npm run test:e2e -- --grep "ras"` (if such a tag exists). Otherwise, skip — the manual check in Task 7 covered the happy path.

- [ ] **Step 4: Refresh graphify**

Per project CLAUDE.md, after modifying code files run:

Run: `graphify update .`

Then commit the graphify-out diff:

```bash
git add graphify-out/GRAPH_REPORT.md graphify-out/graph.html graphify-out/graph.json graphify-out/manifest.json
git commit -m "chore(graph): refresh graphify after late-reaction promotion"
```

---

## Notes for the executor

- **Idempotency:** the conditional `if (input.currentReaction === 'ras')` inside `insertSymptom` is the single source of truth for whether promotion happens. Do not duplicate the check elsewhere.
- **No schema migration:** the change uses existing columns only.
- **Severity helper:** prefer `severityOf` from `$lib/content/symptoms`; do not hard-code the severe-label set.
- **Audit shape:** `from` is the literal `'ras'` for now. If a future PR adds downgrade or other transitions, widen the type.
- **Existing GDPR export:** the new audit event is `console.log`-only today (per `src/lib/server/audit.ts`). No GDPR-export change is needed unless the project adds a persistent audit table later; that's out of scope for this plan.
