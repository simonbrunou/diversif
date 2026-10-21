// lucide/no-deprecated-icons: reject @lucide/svelte icons that the package
// marks @deprecated (#447). svelte-check and this config's untyped ESLint
// ignore @deprecated, so an old icon only shows as an editor strikethrough
// until a Lucide major drops it and breaks the build. The list is read from
// the installed package, so icons deprecated by a later upgrade are caught
// without editing this file.
import { readdirSync, readFileSync } from 'node:fs';

const lucidePackage = '@lucide/svelte';
const componentTypeSuffix = '.svelte.d.ts';

const readText = (dist, path) => readFileSync(new URL(path, dist), 'utf8');

// A Lucide release that changes the files read below must stop the lint run
// rather than quietly check fewer icons.
function fail(detail) {
  throw new Error(`eslint-rules/lucide.js cannot parse @lucide/svelte (${detail}).`);
}

// Maps every export name to the stem of the file it comes from under
// dist/icons/ (circle-alert, or alert-circle for the old name's re-export
// file), which is also its deep-import path. Each name exists plain
// (CircleAlert), Lucide-prefixed (LucideCircleAlert) and Icon-suffixed
// (CircleAlertIcon). `toSameStyle` writes a plain name in
// the style of the name it is stored under, so a suggested replacement
// matches the import it replaces.
function readExports(dist) {
  const exportsByName = new Map();
  for (const [path, toSameStyle] of [
    ['icons/index.d.ts', (name) => name],
    ['aliases/aliases.d.ts', (name) => name],
    ['aliases/prefixed.d.ts', (name) => `Lucide${name}`],
    ['aliases/suffixed.d.ts', (name) => `${name}Icon`]
  ]) {
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

// Renamed and merged icons keep their old name as an alias whose note names
// the new one: `@deprecated ... use {@link CircleAlert} instead`.
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

// Removed icons keep their file and carry the note, a reason with no
// replacement, on their own component type.
function readRemovals(dist) {
  const removals = [];
  for (const entry of readdirSync(new URL('icons/', dist))) {
    if (!entry.endsWith(componentTypeSuffix)) continue;
    const source = readText(dist, `icons/${entry}`);
    if (!source.includes('@deprecated')) continue;
    const reason = /@deprecated (\S.*)/.exec(source)?.[1];
    if (!reason) fail(`no reason after @deprecated in icons/${entry}`);
    removals.push([entry.slice(0, -componentTypeSuffix.length), { reason }]);
  }
  return removals;
}

// Reads the deprecation tables from a @lucide/svelte dist/ directory (a URL
// ending in a slash).
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

const typeWrappers = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion'
]);

// The paths an import source can load. Static imports and import types
// always have one string; a dynamic import can load each side of a `?:` and
// of a logical operator (`||`, `??`, `&&`) and the last item of a `(a, b)`
// sequence, with TypeScript's `as`, `satisfies`, `!` and `<T>` wrappers
// removed.
function sourceBranches(node) {
  if (node?.type === 'ConditionalExpression') {
    return [...sourceBranches(node.consequent), ...sourceBranches(node.alternate)];
  }
  if (node?.type === 'LogicalExpression') {
    return [...sourceBranches(node.left), ...sourceBranches(node.right)];
  }
  if (node?.type === 'SequenceExpression') return sourceBranches(node.expressions.at(-1));
  if (typeWrappers.has(node?.type)) return sourceBranches(node.expression);
  return [node];
}

// The text of a source fixed at compile time: a string literal or a template
// literal with no `${}`.
function fixedText(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return undefined;
}

const isLucide = (text) => text === lucidePackage || text.startsWith(`${lucidePackage}/`);

// TypeScript keys whose subtree is a type, never a value the import loads. A
// function's `returnType` holds a node whose type sits under `typeAnnotation`.
const typeKeys = new Set(['typeAnnotation', 'typeArguments', 'typeParameters']);

// Whether a string or template part inside a computed source starts with a
// Lucide path: `@lucide/svelte/icons/${n}`, `'@lucide/svelte/icons/' + n`,
// or one nested deeper such as `(a ? '@lucide/svelte/icons/x' : b) + c`.
// Strings in type positions (`x as '@lucide/svelte'`) don't count. A tagged
// template part with an invalid escape has no cooked text, so its raw text
// is used.
function spellsLucide(node, visitorKeys) {
  if (node?.type === 'Literal') return typeof node.value === 'string' && isLucide(node.value);
  if (node?.type === 'TemplateElement') return isLucide(node.value.cooked ?? node.value.raw);
  return (visitorKeys[node?.type] ?? [])
    .filter((key) => !typeKeys.has(key))
    .some((key) => [node[key]].flat().some((child) => spellsLucide(child, visitorKeys)));
}

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

    function checkDeepPath(sourceNode, path) {
      const note = deprecatedByFile.get(path.slice(deepPrefix.length));
      const suggest = (name) => deepPrefix + exportsByName.get(name).file;
      if (note) reportDeprecated(sourceNode, path, note, suggest);
    }

    function checkName(node, name, path) {
      if (name === 'icons') {
        context.report({ node, messageId: 'unnamed', data: { source: path } });
        return;
      }
      const icon = exportsByName.get(name);
      const note = icon && deprecatedByFile.get(icon.file);
      if (note) reportDeprecated(node, name, note, icon.toSameStyle);
    }

    // `import('@lucide/svelte').X` in a type names the icon in its
    // qualifier; `.icons.X` starts with the namespace export.
    function checkImportType(node, path, sourceNode) {
      let first = node.qualifier;
      while (first?.type === 'TSQualifiedName') first = first.left;
      if (first) {
        checkName(node, first.name, path);
      } else {
        // Like a dynamic import of a barrel: report on the path.
        context.report({ node: sourceNode, messageId: 'unnamed', data: { source: path } });
      }
    }

    function checkBarrel(node, path, sourceNode) {
      const specifiers = node.specifiers ?? [];
      // `export *` and a dynamic import have no specifiers: report on the
      // path, which also tells a `?:` dynamic import's two sides apart.
      if (!node.specifiers) {
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
          checkName(specifier, specifier.imported.name ?? specifier.imported.value, path);
        } else if (specifier.type === 'ExportSpecifier') {
          checkName(specifier, specifier.local.name ?? specifier.local.value, path);
        }
      }
    }

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
