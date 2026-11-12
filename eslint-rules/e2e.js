// e2e/exact-locator: Playwright's getByText, getByLabel, getByPlaceholder,
// getByTitle and getByAltText with a string, and getByRole with a string
// `name`, match every element whose text, label, placeholder, title, alt text
// or accessible name contains it, ignoring case. #509's
// getByText('Clé enregistrée.') also matched « Aucune clé enregistrée. »
// while the passkeys list refreshed, and failed main's E2E three times
// (#546). #265's short getByLabel matched a field on the previous page. The
// rule asks each call for `{ exact: true }` (#604). A regex literal is a
// deliberate pattern and passes as it is; a test that needs a substring
// disables the rule on that line and says why.
//
// Checked: `x.getByText()`, `x['getByText']()` and x[`getByText`]() (a
// template with no `${}`), and the same for the other methods, chained or
// optional, with TypeScript's `as`, `satisfies`, `!` and `<T>` wrappers
// removed from the method, the text, the options and their values. For the
// five methods that take a text first, the options must be an object
// literal whose last `exact` key, spread or computed key is `exact: true`,
// so `{ exact: true, ...options }` fails: the spread can set it back to
// false. Options held in a variable fail too, since the rule cannot read
// them. A spread of an array literal counts as the values it holds. Any
// other spread before the options fails (`getByText(...args, { exact: true
// })`), since the rule cannot tell which value lands second.
// getByRole matches by role alone, and passes, when it gets no options or
// options that set no `name`. A regex `name` passes too, since Playwright
// ignores `exact` for a regex. The last `name` key, spread or computed key
// decides the name, as for `exact`. Any other getByRole, a string or
// variable `name`, options in a variable or a spread after the role
// included, needs `exact: true` as above.
// Not checked: a method reached through a variable name (`x[name]()`),
// copied off its locator (`const { getByText } = page`, which also loses the
// `this` Playwright needs) or called through `.call()`, `.apply()` or
// `.bind()`.
/**
 * @import { TSESTree } from '@typescript-eslint/utils'
 * @import { RuleModule } from './ast.js'
 */
import { fixedText, isTypeWrapper } from './ast.js';

// What a substring call of each method can match, for the message.
const risks = new Map([
  ['getByText', 'getByText with a string matches any element whose text contains it'],
  [
    'getByLabel',
    'getByLabel with a string matches any element whose label or aria-label contains it'
  ],
  [
    'getByPlaceholder',
    'getByPlaceholder with a string matches any field whose placeholder contains it'
  ],
  ['getByTitle', 'getByTitle with a string matches any element whose title contains it'],
  ['getByAltText', 'getByAltText with a string matches any element whose alt text contains it'],
  [
    'getByRole',
    'getByRole with a string name, or a name the rule cannot read, matches any element of that role whose accessible name contains it'
  ]
]);

// The issue that shows each method's risk.
const issues = new Map([
  ['getByText', '#509'],
  ['getByLabel', '#265']
]);

/**
 * The value under TypeScript wrappers and the parentheses that end an
 * optional chain, as in `(page?.getByText)('a')`.
 * @param {TSESTree.Node | null | undefined} node
 */
function unwrap(node) {
  while (isTypeWrapper(node) || node?.type === 'ChainExpression') node = node.expression;
  return node;
}

/**
 * The values a call receives, in order, as far as the source shows them. A
 * spread of an array literal expands in place. Any other spread ends the
 * list, since the values from there on land where only run time knows;
 * `complete` is then false, so that a spread nested in an array literal
 * ends the outer list too.
 * @param {(TSESTree.Expression | TSESTree.SpreadElement | null)[]} args
 * @returns {{ values: (TSESTree.Node | null | undefined)[], complete: boolean }}
 */
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

/**
 * The method a call reaches, when the source names it.
 * @param {TSESTree.MemberExpression} callee
 */
function methodName({ property, computed }) {
  return computed ? fixedText(unwrap(property)) : property.name;
}

/**
 * The key a property sets, or undefined when only run time knows it.
 * @param {TSESTree.Property} property
 */
function keyName({ key, computed }) {
  if (key.type === 'Literal') return String(key.value);
  return computed ? fixedText(unwrap(key)) : key.name;
}

/**
 * The value of the last member of an object literal that can set `key`: a
 * `key` key, a spread, or a computed key whose name only run time knows.
 * Undefined when no member can set it, null when that member is a spread or
 * a computed key, since only run time knows what it sets.
 * @param {TSESTree.ObjectExpression} options
 * @param {string} key
 */
function lastValue(options, key) {
  const last = options.properties.findLast(
    (member) => member.type === 'SpreadElement' || [undefined, key].includes(keyName(member))
  );
  if (last === undefined) return undefined;
  if (last.type !== 'Property' || keyName(last) !== key) return null;
  return unwrap(last.value);
}

/** @param {TSESTree.Node | null | undefined} node */
const isRegex = (node) => node?.type === 'Literal' && 'regex' in node && Boolean(node.regex);

/** @param {TSESTree.Node | null | undefined} options */
function setsExact(options) {
  if (options?.type !== 'ObjectExpression') return false;
  const value = lastValue(options, 'exact');
  return value?.type === 'Literal' && value.value === true;
}

/**
 * getByRole(role) and getByRole(role, options) match by role alone when the
 * options set no `name`, and Playwright ignores `exact` for a regex `name`.
 * @param {{ values: (TSESTree.Node | null | undefined)[], complete: boolean }} args
 */
function roleNeedsNoExact({ values, complete }) {
  const [, options] = values;
  if (options === undefined) return complete;
  if (options?.type !== 'ObjectExpression') return false;
  const name = lastValue(options, 'name');
  return name === undefined || isRegex(name);
}

/** @type {RuleModule<TSESTree.Node>} */
const exactLocator = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require { exact: true } on Playwright locators that match a string as a substring'
    },
    schema: [],
    messages: {
      substring:
        '{{risk}}, ignoring case ({{issue}}). Pass { exact: true }, or a regex for a pattern, or disable this rule on the line with the reason the test needs a substring.'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);
        if (callee?.type !== 'MemberExpression') return;
        const method = methodName(callee) ?? '';
        const risk = risks.get(method);
        if (risk === undefined) return;
        const args = runtimeArguments(node.arguments);
        if (method === 'getByRole') {
          if (roleNeedsNoExact(args)) return;
        } else if (isRegex(args.values[0])) return;
        if (setsExact(args.values[1])) return;
        context.report({
          node: callee.property,
          messageId: 'substring',
          data: { risk, issue: issues.get(method) ?? '#604' }
        });
      }
    };
  }
};

export default { rules: { 'exact-locator': exactLocator } };
