import { describe, expect, it } from 'vitest';
import { localizedRedirect } from './redirect';

function captureRedirect(fn: () => never): { status: number; location: string } {
  try {
    fn();
  } catch (e) {
    const err = e as { status?: number; location?: string };
    if (typeof err.status === 'number' && typeof err.location === 'string') {
      return { status: err.status, location: err.location };
    }
    throw e;
  }
  throw new Error('expected redirect to throw');
}

describe('localizedRedirect', () => {
  it('passes paths through unchanged for FR (no prefix)', () => {
    const r = captureRedirect(() => localizedRedirect('fr', 303, '/login'));
    expect(r).toEqual({ status: 303, location: '/login' });
  });

  it('prefixes paths with /en for EN visitors', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, '/login'));
    expect(r).toEqual({ status: 303, location: '/en/login' });
  });

  it('maps "/" to "/en" for EN (avoids "/en/")', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, '/'));
    expect(r).toEqual({ status: 303, location: '/en' });
  });

  it('does not double-prefix already-/en paths', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, '/en/login'));
    expect(r).toEqual({ status: 303, location: '/en/login' });
  });

  it('does not prefix bare "/en" path', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, '/en'));
    expect(r).toEqual({ status: 303, location: '/en' });
  });

  it('does not double-prefix "/en?foo=1" or "/en#hash"', () => {
    expect(captureRedirect(() => localizedRedirect('en', 303, '/en?foo=1'))).toEqual({
      status: 303,
      location: '/en?foo=1'
    });
    expect(captureRedirect(() => localizedRedirect('en', 303, '/en#hash'))).toEqual({
      status: 303,
      location: '/en#hash'
    });
  });

  it('still prefixes /english (does not over-match "/en" without a delimiter)', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, '/english'));
    expect(r).toEqual({ status: 303, location: '/en/english' });
  });

  it('passes absolute URLs through unchanged', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, 'https://example.com/x'));
    expect(r).toEqual({ status: 303, location: 'https://example.com/x' });
  });

  it('preserves the redirect status code', () => {
    const r = captureRedirect(() => localizedRedirect('en', 302, '/account'));
    expect(r).toEqual({ status: 302, location: '/en/account' });
  });

  it('preserves query strings on the unprefixed path', () => {
    const r = captureRedirect(() => localizedRedirect('en', 303, '/child/5?logged=1'));
    expect(r).toEqual({ status: 303, location: '/en/child/5?logged=1' });
  });
});
