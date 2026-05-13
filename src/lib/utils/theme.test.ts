import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const browserState = { browser: false };

vi.mock('$app/environment', () => ({
  get browser() {
    return browserState.browser;
  }
}));

import { applyTheme, getStoredTheme, resolveTheme } from './theme';

type Stored = string | null;

function makeBrowserGlobals(opts: { stored: Stored; prefersDark: boolean }) {
  const store = new Map<string, string>();
  if (opts.stored != null) store.set('theme', opts.stored);

  const localStorage = {
    getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k);
    })
  };

  const matchMedia = vi.fn((q: string) => ({
    matches: q.includes('dark') ? opts.prefersDark : false
  }));

  const classList = {
    list: new Set<string>(),
    toggle(cls: string, force?: boolean) {
      const should = force ?? !this.list.has(cls);
      if (should) this.list.add(cls);
      else this.list.delete(cls);
      return should;
    }
  };

  const document = { documentElement: { classList } };

  return { store, localStorage, matchMedia, document, classList };
}

describe('theme : non-browser fallbacks', () => {
  beforeEach(() => {
    browserState.browser = false;
  });

  it('getStoredTheme returns "system" when not in the browser', () => {
    expect(getStoredTheme()).toBe('system');
  });

  it('resolveTheme defaults system → light when not in the browser', () => {
    expect(resolveTheme('system')).toBe('light');
  });

  it('resolveTheme honors explicit theme even outside the browser', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('applyTheme is a no-op when not in the browser', () => {
    expect(() => applyTheme('dark')).not.toThrow();
  });
});

describe('theme : browser behavior', () => {
  let env: ReturnType<typeof makeBrowserGlobals>;

  beforeEach(() => {
    browserState.browser = true;
    env = makeBrowserGlobals({ stored: null, prefersDark: false });
    vi.stubGlobal('localStorage', env.localStorage);
    vi.stubGlobal('window', { matchMedia: env.matchMedia });
    (globalThis as unknown as { matchMedia: typeof env.matchMedia }).matchMedia = env.matchMedia;
    vi.stubGlobal('document', env.document);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getStoredTheme returns "light" or "dark" when stored', () => {
    env.store.set('theme', 'dark');
    expect(getStoredTheme()).toBe('dark');
    env.store.set('theme', 'light');
    expect(getStoredTheme()).toBe('light');
  });

  it('getStoredTheme falls back to "system" for invalid / missing values', () => {
    env.store.set('theme', 'lavender');
    expect(getStoredTheme()).toBe('system');
    env.store.delete('theme');
    expect(getStoredTheme()).toBe('system');
  });

  it('resolveTheme(system) follows prefers-color-scheme', () => {
    expect(resolveTheme('system')).toBe('light');
    env.matchMedia.mockReturnValue({ matches: true });
    expect(resolveTheme('system')).toBe('dark');
  });

  it('applyTheme(dark) toggles the dark class and persists', () => {
    applyTheme('dark');
    expect(env.classList.list.has('dark')).toBe(true);
    expect(env.localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('applyTheme(light) removes the dark class and persists', () => {
    env.classList.list.add('dark');
    applyTheme('light');
    expect(env.classList.list.has('dark')).toBe(false);
    expect(env.localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('applyTheme(system) clears the stored preference', () => {
    env.store.set('theme', 'dark');
    applyTheme('system');
    expect(env.localStorage.removeItem).toHaveBeenCalledWith('theme');
  });
});
