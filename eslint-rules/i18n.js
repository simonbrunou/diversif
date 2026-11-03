// i18n/no-literal-colon-separator: reject a « : » written in a component
// between two parts that come from messages or data. French puts a space
// before the colon and English does not, so text such as
// `{m.label()} : {m.text()}` shows the French space in every locale (#610,
// #624). The punctuation belongs in a message per locale, as
// chromeChildPageTitle does (fr `{page} : {name}`, en `{page}: {name}`).
// French-only content (the guide, the legal pages) disables the rule on the
// line and says why.
//
// Checked, in .svelte files: a text with whitespace before a colon
// (JavaScript's \s, which covers U+00A0 and U+202F, written as themselves or
// as entities) and no letter or digit in it, when it is
// - markup text whose siblings on both sides are a `{…}` tag (`{@html}` and
//   `{@render}` included), or an element or block that holds one somewhere
//   inside, in any branch: `{a} : {b}`, `<strong>{a}</strong> : {b}`,
//   `({a}) : {b}`;
// - the text of an attribute or style: directive value between two `{…}`
//   tags: `title="{a} : {b}"`;
// - the text of a template literal between two `${}`, in markup or in the
//   script: `${a} : ${b}`.
// A ternary's colon is code, not text, so `{a ? b : c}` passes. A text with a
// word in it passes too: its label or its text is static, as in
// `{a}. Adresse postale : {b}` on the French-only privacy page.
// Not checked: a colon that a message carries next to a markup space
// (`<strong>{a}</strong> {m.after()}` with after = ": …"), a string in a tag
// (`{a}{' : '}{b}`), a markup comment next to the text
// (`{a}<!-- x --> : {b}`), string concatenation (`a + ' : ' + b`) and .ts
// files.

const bareSeparator = /^[^\p{L}\p{N}]*\s:[^\p{L}\p{N}]*$/u;

// The branches of a node that render in its place: an element's or a
// block's children, an {#if}'s or {#each}'s {:else}, an {#await}'s three.
const branches = ['children', 'else', 'pending', 'then', 'catch'];

// A `{…}` tag that renders something, or an element or block that holds one.
// A {#snippet} renders nothing where it stands.
function isDynamic(node) {
  if (!node || node.type === 'SvelteSnippetBlock') return false;
  if (node.type === 'SvelteMustacheTag' || node.type === 'SvelteRenderTag') return true;
  return branches.some((key) => [node[key]].flat().some(isDynamic));
}

// Whether the parts on both sides of `node` in `parts` are dynamic.
function betweenDynamicParts(parts, node) {
  const index = parts.indexOf(node);
  return isDynamic(parts[index - 1]) && isDynamic(parts[index + 1]);
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
        if (!bareSeparator.test(node.value)) return;
        if (betweenDynamicParts(node.parent.children ?? node.parent.body, node)) report(node);
      },
      // The text parts of an attribute or a style: directive value.
      SvelteLiteral(node) {
        if (bareSeparator.test(node.value) && betweenDynamicParts(node.parent.value, node)) {
          report(node);
        }
      },
      TemplateLiteral(node) {
        // Only the quasis between two expressions: the first and the last
        // have static text, or nothing, on one side.
        for (const quasi of node.quasis.slice(1, -1)) {
          // A tagged template with an invalid escape (`\u` alone) has no
          // cooked text. Valid escapes such as `\u00a0` are cooked.
          if (bareSeparator.test(quasi.value.cooked ?? '')) report(quasi);
        }
      }
    };
  }
};

export default { rules: { 'no-literal-colon-separator': noLiteralColonSeparator } };
