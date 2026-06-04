import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../app.css'), 'utf8');

const REQUIRED_TOKENS = [
  '--canvas',
  '--surface',
  '--surface-2',
  '--ink',
  '--ink-soft',
  '--border',
  '--ring',
  '--primary',
  '--primary-foreground',
  '--primary-strong',
  '--tile-peach',
  '--tile-peach-foreground',
  '--tile-butter',
  '--tile-butter-foreground',
  '--tile-mint',
  '--tile-mint-foreground',
  '--tile-sky',
  '--tile-sky-foreground',
  '--tile-lilac',
  '--tile-lilac-foreground',
  '--severe',
  '--severe-foreground',
  '--reaction-ras',
  '--reaction-inconfort',
  '--reaction-reaction',
  '--celebrate',
  // Shadows are runtime vars (they differ light/dark) prefixed --ds-* to avoid
  // colliding with the v4 --shadow-* theme namespace; @theme inline maps them
  // back to the shadow-* utilities (asserted in the "theme layer" block below).
  '--ds-shadow-card',
  '--ds-shadow-soft',
  '--ds-shadow-lifted',
  '--ds-shadow-glow',
  '--ease-soft',
  '--ease-spring',
  '--ease-celebrate',
  '--dur-fast',
  '--dur-base',
  '--dur-slow',
  '--dur-celebrate'
];

describe('design tokens', () => {
  describe('light theme (:root)', () => {
    const root = css.match(/:root\s*\{([^}]+(?:\}[^}]*)*?)\}\s*\.dark/s);
    const block = root?.[1] ?? '';

    for (const token of REQUIRED_TOKENS) {
      it(`defines ${token}`, () => {
        expect(block).toMatch(new RegExp(`${token}\\s*:`));
      });
    }
  });

  describe('dark theme (.dark)', () => {
    const dark = css.match(/\.dark\s*\{([^}]+(?:\}[^}]*)*?)\}\s*@media/s);
    const block = dark?.[1] ?? '';

    // tile + brand tokens must be re-declared in dark; some can inherit.
    const DARK_REQUIRED = [
      '--canvas',
      '--surface',
      '--surface-2',
      '--ink-soft',
      '--border',
      '--primary',
      '--primary-strong',
      '--tile-peach',
      '--tile-peach-foreground',
      '--tile-butter',
      '--tile-mint',
      '--tile-sky',
      '--tile-lilac'
    ];
    for (const token of DARK_REQUIRED) {
      it(`re-declares ${token}`, () => {
        expect(block).toMatch(new RegExp(`${token}\\s*:`));
      });
    }
  });

  describe('theme layer (@theme)', () => {
    it('defines the radius scale as static theme tokens', () => {
      expect(css).toMatch(/--radius-tile\s*:/);
      expect(css).toMatch(/--radius-hero\s*:/);
    });

    it('maps shadow utilities to the runtime --ds-shadow-* vars (inline)', () => {
      expect(css).toMatch(/--shadow-card\s*:\s*var\(--ds-shadow-card\)/);
      expect(css).toMatch(/--shadow-glow\s*:\s*var\(--ds-shadow-glow\)/);
    });

    it('maps color utilities to the runtime hsl tokens (inline, dark-switchable)', () => {
      expect(css).toMatch(/--color-primary\s*:\s*hsl\(var\(--primary\)\)/);
      expect(css).toMatch(/--color-tile-peach\s*:\s*hsl\(var\(--tile-peach\)\)/);
    });

    // The --accent-* runtime aliases were removed; bg-accent-*/ring-accent-* must
    // resolve via the tile palette, not an undefined var (would blank the tint).
    it('aliases accent-* tints onto the tile palette', () => {
      expect(css).toMatch(/--color-accent-peach\s*:\s*hsl\(var\(--tile-peach\)\)/);
      expect(css).toMatch(/--color-accent-sky\s*:\s*hsl\(var\(--tile-sky\)\)/);
      // the removed tint aliases must not be referenced (the neutral
      // --color-accent / -foreground legitimately still map to --accent).
      expect(css).not.toMatch(
        /--color-accent-(peach|butter|mint|sky|lilac)\s*:\s*hsl\(var\(--accent-/
      );
    });
  });

  describe('v4 consumer compatibility', () => {
    // duration-*/ease-* must drive tw-animate-css animate-in/out (Modal,
    // bottom-sheet), not just transitions — i.e. set --tw-duration/--tw-ease.
    it('routes named duration/ease through the tw-animate-css vars', () => {
      expect(css).toMatch(/--tw-duration\s*:\s*var\(--dur-slow\)/);
      expect(css).toMatch(/--tw-ease\s*:\s*var\(--ease-spring\)/);
    });

    // v4's default ring offset is white; the app uses bare ring-offset-2, so the
    // canvas default must be restored or dark-mode focus rings get a white gap.
    it('restores the canvas ring-offset default', () => {
      expect(css).toMatch(/--tw-ring-offset-color\s*:\s*hsl\(var\(--canvas\)\)/);
    });
  });

  describe('reduced-motion safeguard', () => {
    it('flattens eases to linear', () => {
      expect(css).toMatch(/prefers-reduced-motion[^}]*--ease-soft\s*:\s*linear/s);
    });
    it('flattens durations to 1ms', () => {
      expect(css).toMatch(/prefers-reduced-motion[^}]*--dur-base\s*:\s*1ms/s);
    });
  });
});
