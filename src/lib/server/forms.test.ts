import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseForm } from './forms';

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
