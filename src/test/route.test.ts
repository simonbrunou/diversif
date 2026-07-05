import { test, expect } from 'bun:test';
import { makeRouteEvent } from './route';

test('makeRouteEvent expands array form values into repeated keys', async () => {
  const ev = makeRouteEvent({ formData: { foodId: ['1', '2', '3'], givenAt: 'x' } });
  const fd = await ev.request.formData();
  expect(fd.getAll('foodId')).toEqual(['1', '2', '3']);
  expect(fd.get('givenAt')).toBe('x');
});

test('makeRouteEvent appends nothing for an empty array value', async () => {
  const ev = makeRouteEvent({ formData: { foodId: [], givenAt: 'x' } });
  const fd = await ev.request.formData();
  expect(fd.getAll('foodId')).toEqual([]);
  expect(fd.get('givenAt')).toBe('x');
});
