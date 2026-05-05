import { randomBytes } from 'node:crypto';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// 32-char alphabet over 6 positions = 32^6 = ~10^9 combinations. With per-IP
// signup rate limiting and a 7-day TTL on each code, brute-forcing an active
// code is impractical even on a shared instance. Bumped from 4 chars (32^4 ≈
// 1M combos) which felt thin for a public deployment.
const INVITE_CODE_LENGTH = 6;
// Legacy 4-character codes generated before the entropy bump may still be
// alive in the DB for up to the 7-day TTL post-deploy. We keep accepting
// them in `isValidInviteCodeFormat` so existing onboarding links don't
// suddenly read as malformed; the *generator* always emits 6 chars.
const LEGACY_INVITE_CODE_LENGTH = 4;

export function generateInviteCodeRaw(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let suffix = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    suffix += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return `BEBE-${suffix}`;
}

export function isValidInviteCodeFormat(code: string): boolean {
  const pattern = new RegExp(
    `^BEBE-([A-Z2-9]{${LEGACY_INVITE_CODE_LENGTH}}|[A-Z2-9]{${INVITE_CODE_LENGTH}})$`
  );
  return pattern.test(code) && !/[0OI1]/.test(code);
}
