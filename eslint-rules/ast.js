// AST helpers the repo's own lint rules share.

// TypeScript's `as`, `satisfies`, `!` and `<T>` wrappers: each holds, under
// `expression`, the value it leaves unchanged at run time.
export const typeWrappers = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion'
]);

// The text of a node fixed at compile time: a string literal or a template
// literal with no `${}`.
export function fixedText(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return undefined;
}
