// lucide/no-deprecated-icons: reject @lucide/svelte icons that the package
// marks @deprecated (#447). svelte-check and this config's untyped ESLint
// ignore @deprecated, so an old icon only shows as an editor strikethrough
// until a Lucide major drops it and breaks the build. The list is read from
// the installed package, so icons deprecated by a later upgrade are caught
// without editing this file.
import { readdirSync, readFileSync } from 'node:fs';

const dist = new URL('./', import.meta.resolve('@lucide/svelte'));
const read = (path) => readFileSync(new URL(path, dist), 'utf8');

function fail(detail) {
  // A Lucide release that changes these files must stop the lint run rather
  // than quietly check fewer icons.
  throw new Error(`eslint-rules/lucide.js cannot parse @lucide/svelte (${detail}).`);
}

// Each icon is one file under dist/icons/. Its plain name (CircleAlert, or an
// old name such as AlertCircle), its Lucide-prefixed name and its
// Icon-suffixed name all re-export that file. `inSameStyle` writes a plain
// name in the export style of the name it is stored under, so a suggested
// replacement matches the import it replaces.
const exportsByName = new Map();
for (const [path, inSameStyle] of [
  ['icons/index.d.ts', (name) => name],
  ['aliases/aliases.d.ts', (name) => name],
  ['aliases/prefixed.d.ts', (name) => `Lucide${name}`],
  ['aliases/suffixed.d.ts', (name) => `${name}Icon`]
]) {
  const exportLines = read(path).matchAll(
    /default as (\w+) \} from '\.\.?\/(?:icons\/)?([\w-]+)\.(?:svelte|js)'/g
  );
  for (const [, name, file] of exportLines) exportsByName.set(name, { file, inSameStyle });
}

// Renamed and merged icons keep their old name as an alias whose note names
// the new one: `@deprecated ... use {@link CircleAlert} instead`.
const deprecatedByFile = new Map();
const aliasSource = read('aliases/aliases.d.ts');
const aliasNotes = [
  ...aliasSource.matchAll(
    /use \{@link (\w+)\} instead\. \*\/\s*default as \w+ \} from '\.\.\/icons\/([\w-]+)\.js'/g
  )
];
if (aliasNotes.length === 0 || aliasNotes.length !== aliasSource.split('@deprecated').length - 1) {
  fail('unrecognised @deprecated notes in aliases/aliases.d.ts');
}
for (const [, replacement, file] of aliasNotes) {
  if (!exportsByName.has(replacement)) fail(`no export named ${replacement}`);
  deprecatedByFile.set(file, { replacement });
}
// Removed icons keep their file and carry the note, a reason with no
// replacement, on their own component type.
for (const entry of readdirSync(new URL('icons/', dist))) {
  if (!entry.endsWith('.svelte.d.ts')) continue;
  const reason = /@deprecated (.+)/.exec(read(`icons/${entry}`))?.[1];
  if (reason) deprecatedByFile.set(entry.slice(0, -'.svelte.d.ts'.length), { reason });
}

const barrels = new Set(['@lucide/svelte', '@lucide/svelte/icons']);
const deepPrefix = '@lucide/svelte/icons/';

const noDeprecatedIcons = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow @lucide/svelte icons marked @deprecated' },
    schema: [],
    messages: {
      renamed: "'{{name}}' is a deprecated Lucide alias: use '{{replacement}}' instead.",
      removed: "'{{name}}' is deprecated in Lucide: {{reason}}",
      // A namespace import, `export *` or dynamic import hides which icons a
      // file uses, so the rule could not check them.
      unnamed:
        "Import icons from '{{source}}' by name so lucide/no-deprecated-icons can check them."
    }
  },
  create(context) {
    function reportDeprecated(node, name, note, suggest) {
      if (note.replacement) {
        context.report({
          node,
          messageId: 'renamed',
          data: { name, replacement: suggest(note.replacement) }
        });
      } else {
        context.report({ node, messageId: 'removed', data: { name, reason: note.reason } });
      }
    }

    function check(node) {
      const source = node.source?.value;
      if (typeof source !== 'string') return;
      if (source.startsWith(deepPrefix)) {
        const note = deprecatedByFile.get(source.slice(deepPrefix.length));
        const suggest = (name) => deepPrefix + exportsByName.get(name).file;
        if (note) reportDeprecated(node.source, source, note, suggest);
        return;
      }
      if (!barrels.has(source)) return;
      const named = (node.specifiers ?? []).filter((s) => s.type !== 'ImportNamespaceSpecifier');
      if (!node.specifiers || named.length < node.specifiers.length) {
        context.report({ node, messageId: 'unnamed', data: { source } });
      }
      for (const specifier of named) {
        // `import { X }` names the import in `imported`, `export { X } from`
        // in `local`; either can be a string literal.
        const id = specifier.type === 'ImportSpecifier' ? specifier.imported : specifier.local;
        const name = id.name ?? id.value;
        const icon = exportsByName.get(name);
        const note = icon && deprecatedByFile.get(icon.file);
        if (note) reportDeprecated(specifier, name, note, icon.inSameStyle);
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
