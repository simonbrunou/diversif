import { expect, test } from 'bun:test';
import { syncResult } from './sync-result';

test('syncResult returns a value the hook returned synchronously', () => {
  expect(syncResult<string | void>('abc')).toBe('abc');
  expect(syncResult<string | void>(undefined)).toBeUndefined();
});

test('syncResult fails the test when the hook returned a promise', () => {
  expect(() => syncResult(Promise.resolve('abc'))).toThrow('expected a synchronous result');
});
