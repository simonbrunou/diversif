/**
 * Reusable stubs for SvelteKit's `$app/*` modules so that components can be
 * mounted in jsdom/happy-dom without a full SvelteKit runtime. Each test
 * file that needs them does:
 *
 *   import './app-stubs'; // registers the $app/* module mocks
 *
 * before importing the component under test.
 */
import { mock } from 'bun:test';

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

mock.module('$app/state', () => ({
  page,
  navigating: {
    type: null,
    from: null,
    to: null,
    willUnload: false,
    delta: 0,
    complete: Promise.resolve()
  },
  updated: { current: false, check: mock(() => {}) }
}));

mock.module('$app/forms', () => ({
  enhance: () => ({ destroy() {} }),
  applyAction: mock(() => {}),
  deserialize: mock(() => {})
}));

mock.module('$app/environment', () => ({
  browser: true,
  building: false,
  dev: true,
  version: 'test'
}));

mock.module('$app/navigation', () => ({
  goto: mock(() => {}),
  invalidate: mock(() => {}),
  invalidateAll: mock(() => {}),
  afterNavigate: mock(() => {}),
  beforeNavigate: mock(() => {})
}));

export function setPagePathname(pathname: string) {
  page.url = new URL(`http://localhost${pathname}`);
}
