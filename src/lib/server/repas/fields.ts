import { REACTION_VALUES, type ReactionId } from '#lib/utils/reaction-values.js';
import { isTextureKey, type TextureKey } from '#lib/utils/textures.js';
import { refuse, type RepasErrorKey } from './core';

// The one parser for every repas form: the log form (create), the single-entry
// edit form and the meal edit form. Each field has one reader and the error
// keys for what the form alone can tell (missing, malformed, too long), so
// create and edit can no longer disagree on what a field means. Checks that
// need the database (date bounds, aliment visibility) run in the write's
// transaction, in index.ts and aliments.ts.

const MAX_ALIMENTS = 20;
const MAX_CUSTOM_NAME = 80;
const MAX_NOTES = 2000;
const MAX_PREPARED_BRAND = 60;
const MAX_PREPARED_NAME = 100;
const MAX_IDEMPOTENCY_KEY = 100;

/** The aliments a form names: catalog ids (deduped, in posted order) and at most one new custom aliment. */
export type AlimentChoice = {
  foodIds: number[];
  custom: { name: string; category: string | undefined } | null;
};

export type PreparedMealChoice = { id: number } | { brand: string; name: string } | null;

/** A submitted reaction plus the value the form loaded, for the guarded write. */
export type ReactionEdit = { to: ReactionId; loaded: ReactionId | null };

export type LogDraft = {
  aliments: AlimentChoice;
  givenAt: Date;
  reaction: ReactionId;
  texture: TextureKey | null;
  notes: string | null;
  preparedMeal: PreparedMealChoice;
};

export type EntryEditDraft = {
  aliments: AlimentChoice;
  givenAt: Date;
  reaction: ReactionEdit;
  texture: TextureKey | null;
  notes: string | null;
};

export type MealEditDraft = {
  givenAt: Date;
  texture: TextureKey | null;
  notes: string | null;
  /** Keyed by entry id; members the form didn't post a reaction for are absent. */
  reactions: Map<number, ReactionEdit>;
};

// A File (or a missing field) reads as absent: none of these forms upload files.
function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === 'string' ? value : undefined;
}

function positiveInt(raw: string, errorKey: RepasErrorKey): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : refuse(errorKey);
}

function givenAtField(form: FormData): Date {
  const raw = text(form, 'givenAt');
  if (!raw) refuse('errorsLogDateRequired');
  const givenAt = new Date(raw);
  if (Number.isNaN(givenAt.getTime())) refuse('errorsLogDateInvalid');
  return givenAt;
}

function reactionValue(raw: string | undefined): ReactionId {
  return REACTION_VALUES.includes(raw as ReactionId)
    ? (raw as ReactionId)
    : refuse('errorsAuthBadInput');
}

// Absent and '' both mean "no texture": the edit form posts '' to clear it.
function textureField(form: FormData): TextureKey | null {
  const raw = text(form, 'texture');
  if (!raw) return null;
  return isTextureKey(raw) ? raw : refuse('errorsLogTextureInvalid');
}

// The cap applies to what is stored, so it is checked after trimming.
function notesField(form: FormData): string | null {
  const notes = text(form, 'notes')?.trim() || null;
  if (notes && notes.length > MAX_NOTES) refuse('errorsLogNoteTooLong');
  return notes;
}

// Repeated `foodId` fields must be read with getAll: Object.fromEntries(form)
// keeps only the last one and silently drops the rest of the meal.
function alimentsField(form: FormData): AlimentChoice {
  const rawIds = form.getAll('foodId').map(String);
  if (rawIds.length > MAX_ALIMENTS) refuse('errorsLogTooManyFoods');
  const foodIds = [...new Set(rawIds.map((raw) => positiveInt(raw, 'errorsLogFoodNotFound')))];

  // A whitespace-only name is no name at all.
  const name = text(form, 'customFood.name')?.trim();
  if (name && name.length > MAX_CUSTOM_NAME) refuse('errorsAuthBadInput');
  const custom = name ? { name, category: text(form, 'customFood.category') } : null;

  if (foodIds.length === 0 && !custom) refuse('errorsLogNoFoodSelected');
  return { foodIds, custom };
}

// A named plat préparé (brand + name, saved for next time) wins over a picked
// saved one; half a name is refused rather than guessed.
function preparedMealField(form: FormData): PreparedMealChoice {
  const brand = text(form, 'preparedMeal.brand')?.trim() ?? '';
  const name = text(form, 'preparedMeal.name')?.trim() ?? '';
  if (brand.length > MAX_PREPARED_BRAND || name.length > MAX_PREPARED_NAME) {
    refuse('errorsAuthBadInput');
  }
  if (!brand !== !name) refuse('errorsAuthBadInput');
  if (brand) return { brand, name };
  const id = text(form, 'preparedMealId');
  return id ? { id: positiveInt(id, 'errorsAuthBadInput') } : null;
}

// `reaction{suffix}` is the submitted value, `reactionLoaded{suffix}` the
// value the form rendered. A single-entry form rendered before PR #434 doesn't
// post it (the meal form always has), and a hand-made request may not either:
// `loaded` is then null, and the write refuses any reaction other than the
// row's current one (#446).
function reactionEditField(form: FormData, suffix: string): ReactionEdit | null {
  const to = text(form, `reaction${suffix}`);
  if (to === undefined) return null;
  const loaded = text(form, `reactionLoaded${suffix}`);
  return { to: reactionValue(to), loaded: loaded === undefined ? null : reactionValue(loaded) };
}

/**
 * The log form's key travels as an `idempotencyKey` field, both from the
 * online submit (src/lib/offline/submit.ts) and from the queue's replay
 * (src/lib/offline/queue.ts).
 */
export function idempotencyKeyField(form: FormData): string | null {
  const key = text(form, 'idempotencyKey') ?? null;
  if (key !== null && (key.length > MAX_IDEMPOTENCY_KEY || !/^[A-Za-z0-9_-]+$/.test(key))) {
    refuse('errorsLogIdempotencyKeyInvalid');
  }
  return key;
}

export function parseLogForm(form: FormData): LogDraft {
  return {
    aliments: alimentsField(form),
    givenAt: givenAtField(form),
    reaction: reactionValue(text(form, 'reaction')),
    texture: textureField(form),
    notes: notesField(form),
    preparedMeal: preparedMealField(form)
  };
}

export function parseEntryEditForm(form: FormData): EntryEditDraft {
  const aliments = alimentsField(form);
  // A standalone entry holds exactly one aliment.
  if (aliments.foodIds.length + (aliments.custom ? 1 : 0) > 1) refuse('errorsAuthBadInput');
  return {
    aliments,
    givenAt: givenAtField(form),
    reaction: reactionEditField(form, '') ?? refuse('errorsAuthBadInput'),
    texture: textureField(form),
    notes: notesField(form)
  };
}

export function parseMealEditForm(form: FormData, memberIds: number[]): MealEditDraft {
  const reactions = new Map<number, ReactionEdit>();
  for (const id of memberIds) {
    const edit = reactionEditField(form, `.${id}`);
    if (edit) reactions.set(id, edit);
  }
  return {
    givenAt: givenAtField(form),
    texture: textureField(form),
    notes: notesField(form),
    reactions
  };
}

export function removeIdField(form: FormData): number {
  return positiveInt(text(form, 'removeId') ?? '', 'errorsLogInvalidRequest');
}
