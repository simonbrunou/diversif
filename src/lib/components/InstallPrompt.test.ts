// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import InstallPrompt from './InstallPrompt.svelte';

vi.mock('$lib/paraglide/messages', () => ({
  installCta: () => 'Installer',
  installIosInstructionsTitle: () => 'Installer sur iPhone',
  installIosInstructionsBody: () =>
    "Appuyez sur le bouton de partage en bas de l'écran, puis « Sur l'écran d'accueil ».",
  installIosInstructionsDismiss: () => 'Fermer'
}));

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

function setStandalone(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
    matches: q === '(display-mode: standalone)' ? matches : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn()
  }));
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders nothing initially on Android (no beforeinstallprompt yet)', () => {
    setUA(ANDROID_UA);
    setStandalone(false);
    render(InstallPrompt);
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();
  });

  it('renders the CTA on Android when beforeinstallprompt fires', async () => {
    setUA(ANDROID_UA);
    setStandalone(false);
    render(InstallPrompt);
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();

    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    event.prompt = vi.fn(() => Promise.resolve());
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);

    expect(await screen.findByRole('button', { name: 'Installer' })).toBeTruthy();
  });

  it('calls event.prompt() when CTA clicked on Android', async () => {
    setUA(ANDROID_UA);
    setStandalone(false);
    render(InstallPrompt);

    const promptFn = vi.fn(() => Promise.resolve());
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
    event.prompt = promptFn;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);

    const btn = await screen.findByRole('button', { name: 'Installer' });
    await fireEvent.click(btn);
    expect(promptFn).toHaveBeenCalled();
  });

  it('renders the CTA on iOS Safari when not standalone', () => {
    setUA(IPHONE_UA);
    setStandalone(false);
    render(InstallPrompt);
    expect(screen.getByRole('button', { name: 'Installer' })).toBeTruthy();
  });

  it('opens iOS instructions modal on click (modal title visible after click)', async () => {
    setUA(IPHONE_UA);
    setStandalone(false);
    render(InstallPrompt);

    await fireEvent.click(screen.getByRole('button', { name: 'Installer' }));
    expect(screen.getByText('Installer sur iPhone')).toBeTruthy();
  });

  it('renders nothing when already installed (display-mode: standalone matches)', () => {
    setUA(IPHONE_UA);
    setStandalone(true);
    render(InstallPrompt);
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();
  });

  it('respects the 30-day dismiss', () => {
    setUA(IPHONE_UA);
    setStandalone(false);
    localStorage.setItem('install-prompt-dismissed', String(Date.now()));
    render(InstallPrompt);
    expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull();
  });

  it('shows the CTA again after 31 days have passed since dismiss', () => {
    setUA(IPHONE_UA);
    setStandalone(false);
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorage.setItem('install-prompt-dismissed', String(thirtyOneDaysAgo));
    render(InstallPrompt);
    expect(screen.getByRole('button', { name: 'Installer' })).toBeTruthy();
  });
});
