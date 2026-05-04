import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getLegalIdentity, isPlaceholder } from './legal';

const KEYS = [
  'LEGAL_CONTROLLER_NAME',
  'LEGAL_CONTROLLER_EMAIL',
  'LEGAL_CONTROLLER_ADDRESS',
  'LEGAL_PUBLICATION_DIRECTOR',
  'LEGAL_HOST_PROVIDER',
  'LEGAL_HOST_PROVIDER_ADDRESS',
  'RETENTION_INACTIVE_DAYS'
];

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    original[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe('getLegalIdentity', () => {
  it('returns placeholders when env vars are missing or blank', () => {
    process.env.LEGAL_CONTROLLER_NAME = '   ';
    const id = getLegalIdentity();
    expect(isPlaceholder(id.controllerName)).toBe(true);
    expect(isPlaceholder(id.controllerEmail)).toBe(true);
    expect(isPlaceholder(id.controllerAddress)).toBe(true);
    expect(isPlaceholder(id.publicationDirector)).toBe(true);
    expect(isPlaceholder(id.hostProvider)).toBe(true);
    expect(isPlaceholder(id.hostProviderAddress)).toBe(true);
    expect(id.retentionInactiveDays).toBe(1095);
  });

  it('reads configured values and trims whitespace', () => {
    process.env.LEGAL_CONTROLLER_NAME = '  Acme  ';
    process.env.LEGAL_CONTROLLER_EMAIL = 'rgpd@acme.fr';
    process.env.RETENTION_INACTIVE_DAYS = '730';

    const id = getLegalIdentity();
    expect(id.controllerName).toBe('Acme');
    expect(id.controllerEmail).toBe('rgpd@acme.fr');
    expect(id.retentionInactiveDays).toBe(730);
  });

  it('falls back to default retention when value is invalid', () => {
    process.env.RETENTION_INACTIVE_DAYS = 'not-a-number';
    expect(getLegalIdentity().retentionInactiveDays).toBe(1095);
  });

  it('falls back to default retention when value is non-positive', () => {
    process.env.RETENTION_INACTIVE_DAYS = '0';
    expect(getLegalIdentity().retentionInactiveDays).toBe(1095);
  });
});
