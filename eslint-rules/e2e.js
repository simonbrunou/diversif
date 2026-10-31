// e2e/exact-get-by-text: Playwright's getByText with a string matches every
// element whose text contains it, ignoring case. #509's
// getByText('Clé enregistrée.') also matched « Aucune clé enregistrée. »
// while the passkeys list refreshed, and failed main's E2E three times
// (#546). The rule asks each call for `{ exact: true }`. A regex literal is a
// deliberate pattern and passes as it is; a test that needs a substring
// disables the rule on that line and says why.
//
// Checked: `x.getByText()`, `x['getByText']()` and x[`getByText`]() (a
// template with no `${}`), chained or optional, with TypeScript's `as`,
// `satisfies`, `!` and `<T>` wrappers removed from the method, the text, the
// options and their values. The options must be an object literal whose last
// `exact` key, spread or computed key is `exact: true`, so
// `{ exact: true, ...options }` fails: the spread can set it back to false.
// Options held in a variable fail too, since the rule cannot read them. A
// spread of an array literal counts as the values it holds. Any other
// spread before the options fails (`getByText(...args, { exact: true })`),
// since the rule cannot tell which value lands second.
// Not checked: a method reached through a variable name (`x[name]()`),
// copied off its locator (`const { getByText } = page`, which also loses the
// `this` Playwright needs) or called through `.call()`, `.apply()` or
// `.bind()`.
import { fixedText, typeWrappers } from './ast.js';

// The value under TypeScript wrappers and the parentheses that end an
// optional chain, as in `(page?.getByText)('a')`.
function unwrap(node) {
  while (typeWrappers.has(node?.type) || node?.type === 'ChainExpression') node = node.expression;
  return node;
}

// The values a call receives, in order, as far as the source shows them. A
// spread of an array literal expands in place. Any other spread ends the
// list, since the values from there on land where only run time knows;
// `complete` is then false, so that a spread nested in an array literal
// ends the outer list too.
function runtimeArguments(args) {
  const values = [];
  for (const arg of args) {
    if (arg?.type !== 'SpreadElement') {
      values.push(unwrap(arg));
      continue;
    }
    const array = unwrap(arg.argument);
    if (array?.type !== 'ArrayExpression') return { values, complete: false };
    const inner = runtimeArguments(array.elements);
    values.push(...inner.values);
    if (!inner.complete) return { values, complete: false };
  }
  return { values, complete: true };
}

function isGetByText(callee) {
  if (callee?.type !== 'MemberExpression') return false;
  const { property, computed } = callee;
  return (computed ? fixedText(unwrap(property)) : property.name) === 'getByText';
}

// The key a property sets, or undefined when only run time knows it.
function keyName({ key, computed }) {
  if (key.type === 'Literal') return String(key.value);
  return computed ? fixedText(unwrap(key)) : key.name;
}

// The last member that can set `exact` decides it: an `exact` key, a spread,
// or a computed key whose name only run time knows.
function setsExact(options) {
  if (options?.type !== 'ObjectExpression') return false;
  const last = options.properties.findLast(
    (member) => member.type === 'SpreadElement' || [undefined, 'exact'].includes(keyName(member))
  );
  if (last?.type !== 'Property' || keyName(last) !== 'exact') return false;
  const value = unwrap(last.value);
  return value.type === 'Literal' && value.value === true;
}

const exactGetByText = {
  meta: {
    type: 'problem',
    docs: { description: 'Require { exact: true } on Playwright getByText calls with a string' },
    schema: [],
    messages: {
      substring:
        'getByText with a string matches any element whose text contains it, ignoring case (#509). Pass { exact: true }, or a regex for a pattern, or disable this rule on the line with the reason the test needs a substring.'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (!isGetByText(callee)) return;
        const [text, options] = runtimeArguments(node.arguments).values;
        if (text?.type === 'Literal' && text.regex) return;
        if (setsExact(options)) return;
        context.report({ node: callee.property, messageId: 'substring' });
      }
    };
  }
};

export default { rules: { 'exact-get-by-text': exactGetByText } };
