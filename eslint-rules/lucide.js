// lucide/no-deprecated-icons: reject @lucide/svelte icons that the package
// marks @deprecated (#447). svelte-check and this config's untyped ESLint
// ignore @deprecated, so an old icon only shows as an editor strikethrough
// until a Lucide major drops it and breaks the build. The list is read from
// the installed package, so icons deprecated by a later upgrade are caught
// without editing this file.
import { readdirSync, readFileSync } from 'node:fs';

const componentTypes = '.svelte.d.ts';

const readText = (dist, path) => readFileSync(new URL(path, dist), 'utf8');

// A Lucide release that changes the files read below must stop the lint run
// rather than quietly check fewer icons.
function fail(detail) {
  throw new Error(`eslint-rules/lucide.js cannot parse @lucide/svelte (${detail}).`);
}

// Every export name points at one file under dist/icons/: a current icon's
// .svelte component, or the .js file that re-exports it under an old name.
// Each name exists plain (CircleAlert), Lucide-prefixed (LucideCircleAlert)
// and Icon-suffixed (CircleAlertIcon). `toSameStyle` writes a plain name in
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
    if (!entry.endsWith(componentTypes)) continue;
    const source = readText(dist, `icons/${entry}`);
    if (!source.includes('@deprecated')) continue;
    const reason = /@deprecated (\S.*)/.exec(source)?.[1];
    if (!reason) fail(`no reason after @deprecated in icons/${entry}`);
    removals.push([entry.slice(0, -componentTypes.length), { reason }]);
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
  new URL('./', import.meta.resolve('@lucide/svelte'))
);
const lucidePackage = '@lucide/svelte';
const barrels = new Set([lucidePackage, `${lucidePackage}/icons`]);
const deepPrefix = `${lucidePackage}/icons/`;

// The fixed text of an import source and whether it is the whole source: a
// string literal, a template literal up to its first `${}`, or the left end
// of a `+` chain.
function readSource(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return { text: node.value, complete: true };
  }
  if (node?.type === 'TemplateLiteral') {
    return { text: node.quasis[0].value.cooked ?? '', complete: node.expressions.length === 0 };
  }
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = readSource(node.left);
    return left && { text: left.text, complete: false };
  }
  return null;
}

const isLucide = (text) => text === lucidePackage || text?.startsWith(`${lucidePackage}/`);

const noDeprecatedIcons = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow @lucide/svelte icons marked @deprecated' },
    schema: [],
    messages: {
      replaced: "'{{name}}' is a deprecated Lucide alias: use '{{replacement}}' instead.",
      removed: "'{{name}}' is deprecated in Lucide: {{reason}}",
      // A namespace import (`import * as`, `import type * as` included), the
      // `icons` namespace export, `export *` or a dynamic import of a barrel
      // hides which icons a file uses, so the rule could not check them.
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

    function checkDeepImport(sourceNode, path) {
      const note = deprecatedByFile.get(path.slice(deepPrefix.length));
      const suggest = (name) => deepPrefix + exportsByName.get(name).file;
      if (note) reportDeprecated(sourceNode, path, note, suggest);
    }

    function checkSpecifier(specifier, path) {
      // `import { X }` names the import in `imported`, `export { X } from`
      // in `local`; either can be a string literal.
      const id = specifier.type === 'ImportSpecifier' ? specifier.imported : specifier.local;
      const name = id.name ?? id.value;
      if (name === 'icons') {
        context.report({ node: specifier, messageId: 'unnamed', data: { source: path } });
        return;
      }
      const icon = exportsByName.get(name);
      const note = icon && deprecatedByFile.get(icon.file);
      if (note) reportDeprecated(specifier, name, note, icon.toSameStyle);
    }

    function checkBarrelImport(node, path) {
      const named = (node.specifiers ?? []).filter((s) => s.type !== 'ImportNamespaceSpecifier');
      if (!node.specifiers || named.length < node.specifiers.length) {
        context.report({ node, messageId: 'unnamed', data: { source: path } });
      }
      for (const specifier of named) checkSpecifier(specifier, path);
    }

    function check(node) {
      const source = readSource(node.source);
      if (!isLucide(source?.text)) return;
      if (!source.complete) {
        context.report({ node: node.source, messageId: 'computed' });
      } else if (source.text.startsWith(deepPrefix)) {
        checkDeepImport(node.source, source.text);
      } else if (barrels.has(source.text)) {
        checkBarrelImport(node, source.text);
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check
    };
  }
};

export default { rules: { 'no-deprecated-icons': noDeprecatedIcons } };
