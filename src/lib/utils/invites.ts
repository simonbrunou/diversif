import { randomBytes } from 'node:crypto';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCodeRaw(): string {
  const bytes = randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return `BEBE-${suffix}`;
}

export function isValidInviteCodeFormat(code: string): boolean {
  return /^BEBE-[A-Z2-9]{4}$/.test(code) && !/[0OI1]/.test(code);
}
