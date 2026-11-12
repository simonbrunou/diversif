// AST helpers the repo's own lint rules share.
/**
 * @import { Rule } from 'eslint'
 * @import { TSESTree } from '@typescript-eslint/utils'
 */
// The node types come from the parsers eslint.config.js runs, which the
// typescript-eslint and eslint-plugin-svelte packages install:
// @typescript-eslint/utils for TSESTree and svelte-eslint-parser for AST.

/**
 * A rule whose visitors take the nodes of `Node`, a parser's node union,
 * keyed by type. ESLint's Rule.RuleModule types each visitor with a plain
 * ESTree node, which has no TSAsExpression, TSImportType or SvelteText.
 * @template {{ type: string }} Node
 * @typedef {Omit<Rule.RuleModule, 'create'> & {
 *   create(context: Rule.RuleContext): { [N in Node as `${N['type']}`]?: (node: N) => void }
 * }} RuleModule
 */

// TypeScript's `as`, `satisfies`, `!` and `<T>` wrappers: each holds, under
// `expression`, the value it leaves unchanged at run time.
const typeWrappers = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion'
]);

/**
 * @param {TSESTree.Node | null | undefined} node
 * @returns {node is TSESTree.TSAsExpression | TSESTree.TSSatisfiesExpression | TSESTree.TSNonNullExpression | TSESTree.TSTypeAssertion}
 */
export const isTypeWrapper = (node) => typeWrappers.has(node?.type ?? '');

/**
 * The text of a node fixed at compile time: a string literal or a template
 * literal with no `${}`.
 * @param {TSESTree.Node | null | undefined} node
 * @returns {string | undefined}
 */
export function fixedText(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    // The cooked text is null only in a tagged template with an invalid
    // escape (`\u` alone), which no caller passes here.
    return node.quasis[0].value.cooked ?? undefined;
  }
  return undefined;
}

/**
 * The nodes under `node[key]`: none for a missing key, the items of an array
 * (null for a hole), or the one node. For a walk that reads its keys at run
 * time (from `sourceCode.visitorKeys`, or a list of keys several node types
 * share), so TypeScript cannot tell which node types have them. The children
 * of a parser's node are nodes of the same parser.
 * @template {{ type: string }} Node
 * @param {Node} node
 * @param {string} key
 * @returns {(Node | null | undefined)[]}
 */
export function childNodes(node, key) {
  const value = /** @type {Record<string, unknown>} */ (node)[key];
  return /** @type {(Node | null | undefined)[]} */ ([value].flat());
}
