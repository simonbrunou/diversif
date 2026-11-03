// i18n/no-literal-colon-separator: reject a « : » written in a component
// between two parts that come from messages or data. French puts a space
// before the colon and English does not, so text such as
// `{m.label()} : {m.text()}` shows the French space in every locale (#610,
// #624). The punctuation belongs in a message per locale, as
// chromeChildPageTitle does (fr `{page} : {name}`, en `{page}: {name}`).
// French-only content (the guide, the legal pages) disables the rule on the
// line and says why.
//
// Checked, in .svelte files: a text that holds only a colon and whitespace,
// with whitespace before the colon (JavaScript's \s, which covers U+00A0 and
// U+202F, written as themselves or as entities), when it is
// - markup text whose siblings on both sides are a `{…}` tag, or an element
//   or block that holds one somewhere inside: `{a} : {b}`,
//   `<strong>{a}</strong> : {b}`;
// - the text of an attribute or style: directive value between two `{…}`
//   tags: `title="{a} : {b}"`;
// - the text of a template literal between two `${}`, in markup or in the
//   script: `${a} : ${b}`.
// A ternary's colon is code, not text, so `{a ? b : c}` passes. A text with
// static content on either side of the colon passes too: `Label : {b}`, or
// `{a}. Adresse postale : {b}` on the French-only privacy page.
// Not checked: a colon that a message carries next to a markup space
// (`<strong>{a}</strong> {m.after()}` with after = ": …"), string
// concatenation (`a + ' : ' + b`) and .ts files.

const spacedColon = /^\s+:\s*$/;

// A `{…}` tag, or an element or block whose children hold one.
function holdsMustache(node) {
  if (node?.type === 'SvelteMustacheTag') return true;
  return Array.isArray(node?.children) && node.children.some(holdsMustache);
}

const noLiteralColonSeparator = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Reject a literal « : » between two dynamic parts of a component'
    },
    schema: [],
    messages: {
      separator:
        'This « : » joins two dynamic parts, so every locale shows the French space before the colon (#624). Take the punctuation from a message per locale, as chromeChildPageTitle does, or disable this rule on the line with the reason the text stays French.'
    }
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'separator' });
    return {
      SvelteText(node) {
        if (!spacedColon.test(node.value)) return;
        const siblings = node.parent.children ?? node.parent.body;
        const index = siblings.indexOf(node);
        if (holdsMustache(siblings[index - 1]) && holdsMustache(siblings[index + 1])) report(node);
      },
      // The text parts of an attribute or a style: directive value.
      SvelteLiteral(node) {
        if (!spacedColon.test(node.value)) return;
        const parts = node.parent.value;
        const index = parts.indexOf(node);
        if (holdsMustache(parts[index - 1]) && holdsMustache(parts[index + 1])) report(node);
      },
      TemplateLiteral(node) {
        // Only the quasis between two expressions: the first and the last
        // have static text, or nothing, on one side.
        for (const quasi of node.quasis.slice(1, -1)) {
          // A tagged template with an invalid escape has no cooked text, and
          // a text with an escape in it is no bare separator.
          if (spacedColon.test(quasi.value.cooked ?? '')) report(quasi);
        }
      }
    };
  }
};

export default { rules: { 'no-literal-colon-separator': noLiteralColonSeparator } };
