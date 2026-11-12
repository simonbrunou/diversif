// lucide/no-deprecated-icons: reject @lucide/svelte icons that the package
// marks @deprecated (#447). svelte-check and this config's untyped ESLint
// ignore @deprecated, so an old icon only shows as an editor strikethrough
// until a Lucide major drops it and breaks the build. The list is read from
// the installed package, so icons deprecated by a later upgrade are caught
// without editing this file.
//
// Checked:
// - static imports and `export ... from` of @lucide/svelte, its icons and
//   icons/index barrels, and @lucide/svelte/icons/<file> deep paths;
// - TypeScript `import('...')` types;
// - dynamic imports whose source is a string, a template with no `${}`, or
//   a `?:`, `||`, `??`, `&&` or `(a, b)` of those, TypeScript wrappers
//   removed;
// - any other dynamic source with a string that starts with a Lucide path
//   gets `computed`.
// Not checked: a path held in a variable, `import.meta.glob` patterns, and
// icons reached through a namespace import that a lint suppression comment
// let in. A static check stops there. (`require()` is already an error under
// @typescript-eslint/no-require-imports.)
/**
 * @import { SourceCode } from 'eslint'
 * @import { TSESTree } from '@typescript-eslint/utils'
 * @import { RuleModule } from './ast.js'
 */
import { readdirSync, readFileSync } from 'node:fs';
import { childNodes, fixedText, isTypeWrapper } from './ast.js';

/**
 * An export of @lucide/svelte: the stem of its file under dist/icons/ and
 * the function that writes a plain icon name in the export's style.
 * @typedef {{ file: string, toSameStyle: (name: string) => string }} Icon
 */
/**
 * Why an icon file is deprecated: the name that replaces it, or the reason
 * it was removed.
 * @typedef {{ replacement: string, reason?: undefined } | { replacement?: undefined, reason: string }} Deprecation
 */
/**
 * The nodes whose source the rule checks for barrels, besides import types.
 * @typedef {TSESTree.ImportDeclaration | TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ImportExpression} ImportNode
 */

const lucidePackage = '@lucide/svelte';
const componentTypeSuffix = '.svelte.d.ts';

/**
 * @param {URL} dist
 * @param {string} path
 */
const readText = (dist, path) => readFileSync(new URL(path, dist), 'utf8');

/**
 * A Lucide release that changes the files read below must stop the lint run
 * rather than quietly check fewer icons.
 * @param {string} detail
 * @returns {never}
 */
function fail(detail) {
  throw new Error(`eslint-rules/lucide.js cannot parse @lucide/svelte (${detail}).`);
}

/**
 * Maps every export name to the stem of the file it comes from under
 * dist/icons/ (circle-exclamation-point, or alert-circle for an old name's
 * re-export file), which is also its deep-import path. Each name exists plain
 * (CircleExclamationPoint), Lucide-prefixed (LucideCircleExclamationPoint)
 * and Icon-suffixed (CircleExclamationPointIcon). `toSameStyle` writes a
 * plain name in the style of the name it is stored under, so a suggested
 * replacement matches the import it replaces.
 * @param {URL} dist
 */
function readExports(dist) {
  /** @type {Map<string, Icon>} */
  const exportsByName = new Map();
  for (const [path, toSameStyle] of /** @type {[string, Icon['toSameStyle']][]} */ ([
    ['icons/index.d.ts', (name) => name],
    ['aliases/aliases.d.ts', (name) => name],
    ['aliases/prefixed.d.ts', (name) => `Lucide${name}`],
    ['aliases/suffixed.d.ts', (name) => `${name}Icon`]
  ])) {
    const source = readText(dist, path);
    const exportLines = [
      ...source.matchAll(/default as (\w+) \} from '\.\.?\/(?:icons\/)?([\w-]+)\.(?:svelte|js)'/g)
    ];
    if (exportLines.length === 0 || exportLines.length !== source.split('export {').length - 1) {
      fail(`unrecognised export lines in ${path}`);
    }
    for (const [, name, file] of exportLines) exportsByName.set(name, { file, toSameStyle });
  }
  return exportsByName;
}

/**
 * Renamed and merged icons keep their old name as an alias. A deprecated
 * alias carries a note that names the new one: `@deprecated ... use
 * {@link CircleExclamationPoint} instead`. An alias with no note, such as
 * CircleAlert since 1.68.0, is a current name.
 * @param {URL} dist
 * @param {Map<string, Icon>} exportsByName
 * @returns {[string, Deprecation][]}
 */
function readAliasNotes(dist, exportsByName) {
  const source = readText(dist, 'aliases/aliases.d.ts');
  const notes = [
    ...source.matchAll(
      /use \{@link (\w+)\} instead\. \*\/\s*default as \w+ \} from '\.\.\/icons\/([\w-]+)\.js'/g
    )
  ];
  if (notes.length === 0 || notes.length !== source.split('@deprecated').length - 1) {
    fail('unrecognised @deprecated notes in aliases/aliases.d.ts');
  }
  return notes.map(([, replacement, file]) => {
    if (!exportsByName.has(replacement)) fail(`no export named ${replacement}`);
    return [file, { replacement }];
  });
}

// A doc comment and the `declare const` it documents.
const documentedDeclaration = /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*(?:export )?declare const (\w+)/g;
/** @param {string} text */
const countNotes = (text) => text.split('@deprecated').length - 1;

/**
 * Removed icons keep their file and carry the note, a reason with no
 * replacement, in the doc comment of their component type (the file's
 * default export). Since 1.60.0 every icon's file also marks its
 * `__iconNode` data export @deprecated, which says nothing about the icon.
 * A note anywhere else stops the lint run. Returns the removal reason, or
 * undefined for a current icon.
 * @param {string} source
 * @param {string} path
 */
function readRemovalReason(source, path) {
  const component = /^export default (\w+);$/m.exec(source)?.[1];
  let notesRead = 0;
  let reason;
  for (const [, doc, name] of source.matchAll(documentedDeclaration)) {
    if (!doc.includes('@deprecated')) continue;
    notesRead += countNotes(doc);
    if (name === '__iconNode') continue;
    if (name !== component) fail(`@deprecated on ${name} in ${path}`);
    reason = /@deprecated (\S.*)/.exec(doc)?.[1];
    if (!reason) fail(`no reason after @deprecated in ${path}`);
  }
  if (notesRead !== countNotes(source)) fail(`@deprecated outside a doc comment in ${path}`);
  return reason;
}

/** @param {URL} dist */
function readRemovals(dist) {
  /** @type {[string, Deprecation][]} */
  const removals = [];
  for (const entry of readdirSync(new URL('icons/', dist))) {
    if (!entry.endsWith(componentTypeSuffix)) continue;
    const path = `icons/${entry}`;
    const reason = readRemovalReason(readText(dist, path), path);
    if (reason) removals.push([entry.slice(0, -componentTypeSuffix.length), { reason }]);
  }
  return removals;
}

/**
 * Reads the deprecation tables from a @lucide/svelte dist/ directory (a URL
 * ending in a slash).
 * @param {URL} dist
 */
export function readLucide(dist) {
  const exportsByName = readExports(dist);
  const deprecatedByFile = new Map([...readAliasNotes(dist, exportsByName), ...readRemovals(dist)]);
  return { exportsByName, deprecatedByFile };
}

const { exportsByName, deprecatedByFile } = readLucide(
  new URL('./', import.meta.resolve(lucidePackage))
);
// icons/index re-exports every current icon, removed ones included.
const barrels = new Set([lucidePackage, `${lucidePackage}/icons`, `${lucidePackage}/icons/index`]);
const deepPrefix = `${lucidePackage}/icons/`;

/**
 * The paths an import source can load. Static imports and import types
 * always have one string; a dynamic import can load each side of a `?:` and
 * of a logical operator (`||`, `??`, `&&`) and the last item of a `(a, b)`
 * sequence, with TypeScript's `as`, `satisfies`, `!` and `<T>` wrappers
 * removed. An `export { x }` has no source, so no path.
 * @param {TSESTree.Node | null | undefined} node
 * @returns {TSESTree.Node[]}
 */
function sourceBranches(node) {
  if (!node) return [];
  if (node.type === 'ConditionalExpression') {
    return [...sourceBranches(node.consequent), ...sourceBranches(node.alternate)];
  }
  if (node.type === 'LogicalExpression') {
    return [...sourceBranches(node.left), ...sourceBranches(node.right)];
  }
  if (node.type === 'SequenceExpression') return sourceBranches(node.expressions.at(-1));
  if (isTypeWrapper(node)) return sourceBranches(node.expression);
  return [node];
}

/**
 * The name an import or export specifier reads, written `X` or `'X'`.
 * @param {TSESTree.Identifier | TSESTree.StringLiteral} node
 */
const moduleExportName = (node) => (node.type === 'Identifier' ? node.name : node.value);

/** @param {string} text */
const isLucide = (text) => text === lucidePackage || text.startsWith(`${lucidePackage}/`);

// TypeScript keys whose subtree is a type, never a value the import loads. A
// function's `returnType` holds a node whose type sits under `typeAnnotation`.
const typeKeys = new Set(['typeAnnotation', 'typeArguments', 'typeParameters']);

/**
 * Whether a string or template part inside a computed source starts with a
 * Lucide path: `@lucide/svelte/icons/${n}`, `'@lucide/svelte/icons/' + n`,
 * or one nested deeper such as `(a ? '@lucide/svelte/icons/x' : b) + c`.
 * Strings under the type keys above (`x as '@lucide/svelte'`,
 * `f<'@lucide/svelte'>()`) don't count; rarer type positions such as a
 * class's `superTypeArguments` are still walked. A tagged
 * template part with an invalid escape has no cooked text, so its raw text
 * is used.
 * @param {TSESTree.Node | null | undefined} node
 * @param {SourceCode.VisitorKeys} visitorKeys
 * @returns {boolean}
 */
function spellsLucide(node, visitorKeys) {
  if (!node) return false;
  if (node.type === 'Literal') return typeof node.value === 'string' && isLucide(node.value);
  if (node.type === 'TemplateElement') return isLucide(node.value.cooked ?? node.value.raw);
  return (visitorKeys[node.type] ?? [])
    .filter((key) => !typeKeys.has(key))
    .some((key) => childNodes(node, key).some((child) => spellsLucide(child, visitorKeys)));
}

/** @type {RuleModule<TSESTree.Node>} */
const noDeprecatedIcons = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow @lucide/svelte icons marked @deprecated' },
    schema: [],
    messages: {
      replaced: "'{{name}}' is a deprecated Lucide alias: use '{{replacement}}' instead.",
      removed: "'{{name}}' is deprecated in Lucide: {{reason}}",
      // A namespace import (`import * as`, `import type * as` included), the
      // `icons` namespace export, `export *`, a dynamic import of a barrel or
      // a bare `typeof import(barrel)` hides which icons a file uses, so the
      // rule could not check them.
      unnamed:
        "Import icons from '{{source}}' by name so lucide/no-deprecated-icons can check them.",
      computed:
        'Import Lucide icons from a fixed path so lucide/no-deprecated-icons can check them.'
    }
  },
  create(context) {
    /**
     * @param {TSESTree.Node} node
     * @param {string} name
     * @param {Deprecation} note
     * @param {(name: string) => string} suggest
     */
    function reportDeprecated(node, name, note, suggest) {
      if (note.replacement) {
        context.report({
          node,
          messageId: 'replaced',
          data: { name, replacement: suggest(note.replacement) }
        });
      } else {
        context.report({ node, messageId: 'removed', data: { name, reason: note.reason } });
      }
    }

    /**
     * @param {TSESTree.Node} sourceNode
     * @param {string} path
     */
    function checkDeepPath(sourceNode, path) {
      const note = deprecatedByFile.get(path.slice(deepPrefix.length));
      // readAliasNotes stops the lint run on a replacement it cannot export.
      /** @param {string} name */
      const suggest = (name) => deepPrefix + /** @type {Icon} */ (exportsByName.get(name)).file;
      if (note) reportDeprecated(sourceNode, path, note, suggest);
    }

    /**
     * @param {TSESTree.Node} node
     * @param {string} name
     * @param {string} path
     */
    function checkName(node, name, path) {
      if (name === 'icons') {
        context.report({ node, messageId: 'unnamed', data: { source: path } });
        return;
      }
      const icon = exportsByName.get(name);
      const note = icon && deprecatedByFile.get(icon.file);
      if (icon && note) reportDeprecated(node, name, note, icon.toSameStyle);
    }

    /**
     * `import('@lucide/svelte').X` in a type names the icon in its
     * qualifier; `.icons.X` starts with the namespace export.
     * @param {TSESTree.TSImportType} node
     * @param {string} path
     * @param {TSESTree.Node} sourceNode
     */
    function checkImportType(node, path, sourceNode) {
      let first = node.qualifier;
      while (first?.type === 'TSQualifiedName') first = first.left;
      // The type also allows `this`, which the parser reads as an
      // Identifier in an import type: `import('x').this` has a name.
      if (first?.type === 'Identifier') {
        checkName(node, first.name, path);
      } else {
        // Like a dynamic import of a barrel: report on the path.
        context.report({ node: sourceNode, messageId: 'unnamed', data: { source: path } });
      }
    }

    /**
     * @param {ImportNode} node
     * @param {string} path
     * @param {TSESTree.Node} sourceNode
     */
    function checkBarrel(node, path, sourceNode) {
      const specifiers = 'specifiers' in node ? node.specifiers : [];
      // `export *` and a dynamic import have no specifiers: report on the
      // path, which also tells a `?:` dynamic import's two sides apart.
      if (!('specifiers' in node)) {
        context.report({ node: sourceNode, messageId: 'unnamed', data: { source: path } });
      } else if (specifiers.some((s) => s.type === 'ImportNamespaceSpecifier')) {
        context.report({ node, messageId: 'unnamed', data: { source: path } });
      }
      // The barrels have no default export (TypeScript rejects a default
      // import), so only named specifiers can reach an icon.
      // `import { X }` names the import in `imported`, `export { X } from`
      // in `local`; either can be a string literal.
      for (const specifier of specifiers) {
        if (specifier.type === 'ImportSpecifier') {
          checkName(specifier, moduleExportName(specifier.imported), path);
        } else if (specifier.type === 'ExportSpecifier') {
          checkName(specifier, moduleExportName(specifier.local), path);
        }
      }
    }

    /**
     * @template {ImportNode | TSESTree.TSImportType} N
     * @param {N} node
     * @param {(node: N, path: string, sourceNode: TSESTree.Node) => void} onBarrel
     */
    function checkSource(node, onBarrel) {
      for (const branch of sourceBranches(node.source)) {
        const path = fixedText(branch);
        if (path === undefined) {
          if (spellsLucide(branch, context.sourceCode.visitorKeys)) {
            context.report({ node: branch, messageId: 'computed' });
          }
        } else if (barrels.has(path)) {
          onBarrel(node, path, branch);
        } else if (path.startsWith(deepPrefix)) {
          checkDeepPath(branch, path);
        }
      }
    }

    /** @param {ImportNode} node */
    const check = (node) => checkSource(node, checkBarrel);

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
      TSImportType: (node) => checkSource(node, checkImportType)
    };
  }
};

export default { rules: { 'no-deprecated-icons': noDeprecatedIcons } };
