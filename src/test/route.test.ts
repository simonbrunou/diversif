import { test, expect } from 'bun:test';
import { loadData, makeRouteEvent } from './route';

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

test('makeRouteEvent setHeaders throws on a header set twice, like SvelteKit', () => {
  const ev = makeRouteEvent();
  ev.setHeaders({ 'Clear-Site-Data': '"cache"' });
  expect(() => ev.setHeaders({ 'clear-site-data': '"storage"' })).toThrow(/already set/);
});

test('makeRouteEvent cookies.getAll lists every cookie the jar holds', () => {
  const ev = makeRouteEvent({ cookies: { session: 'abc' } });
  ev.cookies.set('theme', 'dark', { path: '/' });
  expect(ev.cookies.getAll()).toEqual([
    { name: 'session', value: 'abc' },
    { name: 'theme', value: 'dark' }
  ]);
});

test('makeRouteEvent cookies.get answers undefined for a missing cookie, as SvelteKit does', () => {
  expect(makeRouteEvent().cookies.get('session')).toBeUndefined();
});

test('loadData returns the data a load returned', () => {
  const data = { child: { id: 1 } };
  expect(loadData(data)).toBe(data);
});

test('loadData fails the test when the load returned nothing', () => {
  const nothing: { child: { id: number } } | void = undefined;
  expect(() => loadData(nothing)).toThrow('load returned nothing');
});
