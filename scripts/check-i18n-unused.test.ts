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
    ['a quoted key', "fail(400, { errorKey: 'errorsFoo' });"],
    ['a keep directive', '// i18n-keep: errorsBar errorsFoo']
  ])('counts %s as a use', (_name, source) => {
    expect(unused(source)).toEqual([]);
  });

  it.each([
    ['no mention', 'throw error(400, m.errorsBar());'],
    ['a longer key that starts with it', 'm.errorsFooBar(); m.errorsFoo_x; m.errorsFoo$y'],
    ['another object whose name ends in m', 'item.errorsFoo();'],
    ['the bare word', 'errorsFoo is documented here'],
    ['a keep directive for another key', '// i18n-keep: errorsBar']
  ])('reports the key for %s', (_name, source) => {
    expect(unused(source)).toEqual(['errorsFoo']);
  });

  it('reads keep directives from every source', () => {
    expect(findUnusedKeys(['errorsFoo', 'errorsBar'], ['// i18n-keep: errorsFoo', 'x'])).toEqual([
      'errorsBar'
    ]);
  });
});
