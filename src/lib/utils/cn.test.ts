import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    const dropMe: string | false = false;
    expect(cn('a', dropMe, null, undefined, '', 'c')).toBe('a c');
  });

  it('merges conflicting tailwind utilities (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles arrays and objects via clsx', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});
