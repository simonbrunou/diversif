import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year

export function getStoredTheme(): Theme {
  if (!browser) return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (!browser) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  if (!browser) return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, theme);
  // Mirror the choice in a cookie so the server can render the right
  // initial state (hooks.server.ts adds class="dark" to <html>) and the
  // Profil meta row reflects reality. Deliberately NOT HttpOnly: the
  // client owns this value too. localStorage stays the client-side source;
  // both are always written together.
  document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=${COOKIE_MAX_AGE_S}; samesite=lax`;
}
