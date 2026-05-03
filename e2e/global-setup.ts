import { rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export default async function globalSetup() {
  const dir = path.resolve('./.e2e-data');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
