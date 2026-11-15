# Per-child avatars

Diversif does not offer per-child avatars: every child shows the same drawn sprout.

## Why this is out of scope

The avatar is a decoration, not an identity. `ChildHeaderPill` and `ChildSwitcherDrawer` both render a lucide `Sprout` on the shared `.bg-avatar-tile` gradient (defined in `src/app.css`), and both mark that tile `aria-hidden="true"`. The child's name, printed next to the tile, is what tells one child from another, for sighted parents and for assistive tech alike. An abridged excerpt of the header pill's markup:

```svelte
<span class="bg-avatar-tile ..." aria-hidden="true">
  <Sprout size={18} />
</span>
<span class="flex flex-col">
  <span class="text-sm font-bold leading-tight">{child.name}</span>
  <span class="text-xs text-ink-soft">{ageLabel}</span>
</span>
```

PRODUCT.md describes the app as deliberately small, and none of its scenes (logging, review, 11pm, cold open) needs a picture to tell children apart. Building avatars would add, for no stated need:

- a nullable avatar column on the `children` table, with its migration;
- a picker in child settings, and a settings action that validates the choice;
- a new `ui/Avatar` component that owns the tile background;
- a new field in the RGPD export of a child.

DESIGN.md bans an emoji or a unicode glyph where an icon belongs, which rules out emoji avatars, the form the old `avatarSeed` slot held. Photo upload stayed out of scope even in the build option of #364's first triage brief. The only version left would be a closed set of drawn glyphs, and that still costs every item in the list above.

Before #359, every child already got the same hardcoded `avatarSeed: '🌱'`. It looked like per-child data and wasn't. Bringing back a constant prop without the column and the picker would recreate that misleading state, so #359 removed the slot and this decision keeps it out.

## Prior requests

- #364: "Per-child avatars: decide whether to build them or close the idea"
