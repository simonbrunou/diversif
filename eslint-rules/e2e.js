// e2e/exact-get-by-text: Playwright's getByText with a string matches every
// element whose text contains it, ignoring case. #509's
// getByText('Clé enregistrée.') also matched « Aucune clé enregistrée. »
// while the passkeys list refreshed, and failed main's E2E three times
// (#546). The rule asks each call for `{ exact: true }`. A regex literal is a
// deliberate pattern and passes as it is; a test that needs a substring
// disables the rule on that line and says why.
//
// Checked: `x.getByText()`, `x['getByText']()` and x[`getByText`]() (a
// template with no `${}`), chained or optional. The options must be an
// object literal whose last `exact` key, spread or computed key is
// `exact: true`, so `{ exact: true, ...options }` fails: the spread can set
// it back to false. Options held in a variable fail too, since the rule
// cannot read them.
// Not checked: a method reached through a variable name (`x[name]()`) or
// copied off its locator (`const { getByText } = page`), which also loses
// the `this` Playwright needs.

function isGetByText({ property, computed }) {
  if (!computed) return property.type === 'Identifier' && property.name === 'getByText';
  if (property.type === 'Literal') return property.value === 'getByText';
  return (
    property.type === 'TemplateLiteral' &&
    property.expressions.length === 0 &&
    property.quasis[0].value.cooked === 'getByText'
  );
}

// The key a property sets, or undefined when only run time knows it.
function keyName({ key, computed }) {
  if (key.type === 'Literal') return String(key.value);
  if (key.type === 'Identifier' && !computed) return key.name;
  return undefined;
}

// The last member that can set `exact` decides it: an `exact` key, a spread,
// or a computed key whose name only run time knows.
function setsExact(options) {
  if (options?.type !== 'ObjectExpression') return false;
  const last = options.properties.findLast(
    (member) => member.type === 'SpreadElement' || [undefined, 'exact'].includes(keyName(member))
  );
  return (
    last?.type === 'Property' &&
    keyName(last) === 'exact' &&
    last.value.type === 'Literal' &&
    last.value.value === true
  );
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
        if (node.callee.type !== 'MemberExpression' || !isGetByText(node.callee)) return;
        const [text, options] = node.arguments;
        if (text?.type === 'Literal' && text.regex) return;
        if (setsExact(options)) return;
        context.report({ node: node.callee.property, messageId: 'substring' });
      }
    };
  }
};

export default { rules: { 'exact-get-by-text': exactGetByText } };
