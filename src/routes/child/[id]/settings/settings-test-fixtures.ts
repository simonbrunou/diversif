import { beforeAll } from 'bun:test';
import { hashPassword } from '$lib/server/auth';
import { seedChild, seedMembership, seedUser } from '../../../../test/route';

export const PASSWORD = 'current-password-12';

let realHash: string;

beforeAll(async () => {
  // Hash once per file (~50 ms) and reuse across every setup() call. The
  // deleteChild action verifies the password via argon2id, so the seeded
  // user must hold a real hash, not a placeholder.
  realHash = await hashPassword(PASSWORD);
});

export async function setup(opts: { role?: 'owner' | 'member' } = {}) {
  const u = await seedUser({ passwordHash: realHash });
  const c = await seedChild({ createdBy: u.id, name: 'Bébé' });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: opts.role ?? 'owner' });
  return { u, c, m };
}
