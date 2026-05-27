/**
 * Reusable stubs for SvelteKit's `$app/*` modules so that components can be
 * mounted in jsdom/happy-dom without a full SvelteKit runtime. Each test
 * file that needs them does:
 *
 *   import './app-stubs'; // hoists the vi.mock calls
 *
 * before importing the component under test.
 */
import { vi } from 'vitest';

const page = {
  url: new URL('http://localhost/'),
  params: {},
  route: { id: '/' },
  status: 200,
  error: null,
  data: {},
  form: null,
  state: {}
};

vi.mock('$app/state', () => ({
  page,
  navigating: {
    type: null,
    from: null,
    to: null,
    willUnload: false,
    delta: 0,
    complete: Promise.resolve()
  },
  updated: { current: false, check: vi.fn() }
}));

vi.mock('$app/forms', () => ({
  enhance: () => ({ destroy() {} }),
  applyAction: vi.fn(),
  deserialize: vi.fn()
}));

vi.mock('$app/environment', () => ({
  browser: true,
  building: false,
  dev: true,
  version: 'test'
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn()
}));

export function setPagePathname(pathname: string) {
  page.url = new URL(`http://localhost${pathname}`);
}
