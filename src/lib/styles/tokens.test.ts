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
  '--radius-tile',
  '--radius-hero',
  '--shadow-card',
  '--shadow-soft',
  '--shadow-lifted',
  '--shadow-glow',
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

  describe('reduced-motion safeguard', () => {
    it('flattens eases to linear', () => {
      expect(css).toMatch(/prefers-reduced-motion[^}]*--ease-soft\s*:\s*linear/s);
    });
    it('flattens durations to 1ms', () => {
      expect(css).toMatch(/prefers-reduced-motion[^}]*--dur-base\s*:\s*1ms/s);
    });
  });
});
