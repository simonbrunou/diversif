import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { parseForm, parseFormWithKey } from './forms';

function makeRequest(data: Record<string, string>): Request {
  const body = new URLSearchParams(data);
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
}

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  age: z.coerce.number().int().positive('Âge invalide')
});

describe('parseForm', () => {
  it('returns ok:true with typed data on a valid submission', async () => {
    const result = await parseForm(makeRequest({ name: 'Alice', age: '3' }), schema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Alice');
      expect(result.data.age).toBe(3);
    }
  });

  it('returns ok:false with a 400 failure when schema validation fails', async () => {
    const result = await parseForm(makeRequest({ name: '', age: '3' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
    }
  });

  it('includes the first zod error message in the failure', async () => {
    const result = await parseForm(makeRequest({ name: 'Alice', age: '-1' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const data = result.failure.data as { error: string };
      expect(data.error).toBe('Âge invalide');
    }
  });

  it('echoes submitted values back in the failure payload', async () => {
    const result = await parseForm(makeRequest({ name: '', age: '5' }), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const data = result.failure.data as { values?: Record<string, FormDataEntryValue> };
      expect(data.values?.name).toBe('');
    }
  });
});

describe('parseFormWithKey', () => {
  it('returns ok:true with typed data on a valid submission', async () => {
    const result = await parseFormWithKey(makeRequest({ name: 'Alice', age: '3' }), schema, {
      field: 'errorKey',
      badInputKey: 'errorsAuthBadInput'
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Alice');
    }
  });

  it('returns the caller-specified field + key on validation failure', async () => {
    const result = await parseFormWithKey(makeRequest({ name: '', age: '3' }), schema, {
      field: 'passwordErrorKey',
      badInputKey: 'errorsAuthBadInput'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
      const data = result.failure.data as Record<string, string>;
      expect(data.passwordErrorKey).toBe('errorsAuthBadInput');
      expect(data.error).toBeUndefined();
    }
  });

  it('supports any field name (e.g. deleteErrorKey, profileErrorKey)', async () => {
    const result = await parseFormWithKey(makeRequest({ name: '', age: '3' }), schema, {
      field: 'deleteErrorKey',
      badInputKey: 'errorsAccountDeleteInvalid'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const data = result.failure.data as Record<string, string>;
      expect(data.deleteErrorKey).toBe('errorsAccountDeleteInvalid');
    }
  });

  it('echoes named form fields into the failure payload', async () => {
    const result = await parseFormWithKey(makeRequest({ name: '', age: 'bogus' }), schema, {
      field: 'errorKey',
      badInputKey: 'errorsAuthBadInput',
      echo: ['name']
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const data = result.failure.data as Record<string, string>;
      expect(data.errorKey).toBe('errorsAuthBadInput');
      expect(data.name).toBe('');
      // age was NOT in echo list — must not leak (caller's discretion to avoid secrets)
      expect(data.age).toBeUndefined();
    }
  });

  it('silently skips echo entries that were absent from the submission', async () => {
    // Echo list references a field the form didn't post — payload must still
    // resolve cleanly without an undefined key sneaking in.
    const result = await parseFormWithKey(makeRequest({ name: '', age: 'bogus' }), schema, {
      field: 'errorKey',
      badInputKey: 'errorsAuthBadInput',
      echo: ['name', 'inviteCode'] as const
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const data = result.failure.data as Record<string, string | undefined>;
      expect(data.name).toBe('');
      expect(Object.prototype.hasOwnProperty.call(data, 'inviteCode')).toBe(false);
    }
  });

  it('does not echo fields when echo is omitted', async () => {
    const result = await parseFormWithKey(makeRequest({ name: 'Alice', age: 'bogus' }), schema, {
      field: 'errorKey',
      badInputKey: 'errorsAuthBadInput'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const data = result.failure.data as Record<string, string>;
      expect(data.name).toBeUndefined();
      expect(data.age).toBeUndefined();
    }
  });
});
