// Which uses of a message key keep check-i18n-unused quiet.
import { describe, expect, it } from 'bun:test';
import { findUnusedKeys } from './check-i18n-unused';

const unused = (source: string) => findUnusedKeys(['errorsFoo'], [source]);

describe('findUnusedKeys', () => {
  it.each([
    ['a call', 'throw error(400, m.errorsFoo());'],
    // #659: parseIntParam(raw, m.errorsEntryIdInvalid) was reported unused.
    ['a message function passed on', 'parseIntParam(params.entryId, m.errorsFoo);'],
    ['a reference at the end of the text', 'const msg = m.errorsFoo'],
    ['a call at the start of the text', 'm.errorsFoo();'],
    ['a spread call', 'list.push(...m.errorsFoo());'],
    ['a single-quoted key', "fail(400, { errorKey: 'errorsFoo' });"],
    ['a double-quoted key', 'fail(400, { errorKey: "errorsFoo" });'],
    ['a key in backticks', 'const key = `errorsFoo`;'],
    ['a keep directive', '// i18n-keep: errorsBar errorsFoo']
  ])('counts %s as a use', (_name, source) => {
    expect(unused(source)).toEqual([]);
  });

  it.each([
    ['no mention', 'throw error(400, m.errorsBar());'],
    ['a longer key', 'm.errorsFooBar();'],
    ['a longer key with an underscore', 'm.errorsFoo_x;'],
    ['a longer key with a dollar sign', 'm.errorsFoo$y;'],
    ['another object whose name ends in m', 'item.errorsFoo();'],
    ['another object named $m', '$m.errorsFoo;'],
    ['a property m of another object', 'foo.m.errorsFoo;'],
    ['the bare word', 'errorsFoo is documented here'],
    ['a keep directive for another key', '// i18n-keep: errorsBar']
  ])('reports the key for %s', (_name, source) => {
    expect(unused(source)).toEqual(['errorsFoo']);
  });

  it('reads keep directives from every source, not only the first', () => {
    expect(findUnusedKeys(['errorsFoo', 'errorsBar'], ['x', '// i18n-keep: errorsFoo'])).toEqual([
      'errorsBar'
    ]);
  });
});
