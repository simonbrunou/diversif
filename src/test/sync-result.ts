/**
 * The value a hook typed `MaybePromise<T>` returned, for a test that knows the
 * hook ran synchronously, such as SvelteKit's `handleError` hooks. Fails the
 * test when the hook returned a promise.
 */
export function syncResult<T>(result: T | Promise<T>): T {
  if (result instanceof Promise) throw new Error('expected a synchronous result, got a promise');
  return result;
}
