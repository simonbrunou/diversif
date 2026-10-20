import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RuleTester } from 'eslint';
import ts from 'typescript-eslint';
import lucide, { readLucide } from './lucide.js';

RuleTester.describe = describe;
RuleTester.it = it;

// These cases run against the installed @lucide/svelte, so they also prove
// that its current files still parse.
new RuleTester({ languageOptions: { parser: ts.parser } }).run(
  'lucide/no-deprecated-icons',
  lucide.rules['no-deprecated-icons'],
  {
    valid: [
      "import { Trash, CircleAlert, LucideTrash, TrashIcon, Icon, defaultAttributes, type LucideIcon } from '@lucide/svelte';",
      "import Trash from '@lucide/svelte/icons/trash';",
      "import * as context from '@lucide/svelte/context';",
      "import '@lucide/svelte';",
      'const x = 1; export { x };',
      "const lazy = () => import('@lucide/svelte/icons/trash');",
      "import { Trash2 } from 'other-icons';",
      'const load = (n) => import(`./icons/${n}`);'
    ],
    invalid: [
      {
        code: "import { Trash2, Loader2 as Spin } from '@lucide/svelte';",
        errors: [
          { messageId: 'replaced', data: { name: 'Trash2', replacement: 'Trash' } },
          { messageId: 'replaced', data: { name: 'Loader2', replacement: 'LoaderCircle' } }
        ]
      },
      {
        code: "import { LucideAlertCircle, AlertTriangleIcon } from '@lucide/svelte/icons';",
        errors: [
          {
            messageId: 'replaced',
            data: { name: 'LucideAlertCircle', replacement: 'LucideCircleAlert' }
          },
          {
            messageId: 'replaced',
            data: { name: 'AlertTriangleIcon', replacement: 'TriangleAlertIcon' }
          }
        ]
      },
      {
        code: "import type { AlertCircle } from '@lucide/svelte';",
        errors: [
          { messageId: 'replaced', data: { name: 'AlertCircle', replacement: 'CircleAlert' } }
        ]
      },
      {
        code: "export { Smile } from '@lucide/svelte';",
        errors: [
          { messageId: 'replaced', data: { name: 'Smile', replacement: 'FaceSlightlySmiling' } }
        ]
      },
      {
        code: "import Done from '@lucide/svelte/icons/check-circle-2';",
        errors: [
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/check-circle-2',
              replacement: '@lucide/svelte/icons/circle-check'
            }
          }
        ]
      },
      {
        code: "const lazy = () => import('@lucide/svelte/icons/trash-2');",
        errors: [
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/trash-2',
              replacement: '@lucide/svelte/icons/trash'
            }
          }
        ]
      },
      {
        code: "import { SwissFranc, LucideSwissFranc } from '@lucide/svelte';",
        errors: [{ messageId: 'removed' }, { messageId: 'removed' }]
      },
      {
        code: "import Franc from '@lucide/svelte/icons/badge-swiss-franc';",
        errors: [{ messageId: 'removed' }]
      },
      { code: "import * as L from '@lucide/svelte';", errors: [{ messageId: 'unnamed' }] },
      { code: "import { icons } from '@lucide/svelte';", errors: [{ messageId: 'unnamed' }] },
      { code: "export * from '@lucide/svelte/icons';", errors: [{ messageId: 'unnamed' }] },
      { code: "const lazy = () => import('@lucide/svelte');", errors: [{ messageId: 'unnamed' }] },
      {
        code: 'const load = (n) => import(`@lucide/svelte/icons/${n}`);',
        errors: [{ messageId: 'computed' }]
      },
      {
        code: "const load = (n) => import('@lucide/svelte/icons/' + n);",
        errors: [{ messageId: 'computed' }]
      }
    ]
  }
);

// A minimal dist/ in the shape @lucide/svelte 1.51.0 ships.
const files = {
  'icons/index.d.ts': [
    "export { default as Trash } from './trash.svelte';",
    "export { default as SwissFranc } from './swiss-franc.svelte';"
  ].join('\n'),
  'aliases/aliases.d.ts': [
    'export { ',
    '/** @deprecated The icon was combined with another icon, use {@link Trash} instead. */',
    "default as Trash2 } from '../icons/trash-2.js';"
  ].join('\n'),
  'aliases/prefixed.d.ts': [
    "export { default as LucideTrash } from '../icons/trash.js';",
    'export { ',
    '/** @deprecated The icon was combined with another icon, use {@link Trash} instead. */',
    "default as LucideTrash2 } from '../icons/trash-2.js';"
  ].join('\n'),
  'aliases/suffixed.d.ts': "export { default as TrashIcon } from '../icons/trash.js';",
  'icons/trash.svelte.d.ts': '/** Lucide SVG icon component. */',
  'icons/swiss-franc.svelte.d.ts': '/**\n * @deprecated Removed because it became obsolete.\n */'
};

describe('readLucide', () => {
  const dirs = [];
  function dist(overrides = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'lucide-dist-'));
    dirs.push(dir);
    for (const [path, text] of Object.entries({ ...files, ...overrides })) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return pathToFileURL(`${dir}/`);
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('maps every export style to its file and reads both kinds of deprecation', () => {
    const { exportsByName, deprecatedByFile } = readLucide(dist());
    expect(exportsByName.get('LucideTrash2').file).toBe('trash-2');
    expect(exportsByName.get('LucideTrash2').toSameStyle('Trash')).toBe('LucideTrash');
    expect(exportsByName.get('TrashIcon').toSameStyle('Trash')).toBe('TrashIcon');
    expect(deprecatedByFile.get('trash-2')).toEqual({ replacement: 'Trash' });
    expect(deprecatedByFile.get('swiss-franc')).toEqual({
      reason: 'Removed because it became obsolete.'
    });
    expect(deprecatedByFile.has('trash')).toBe(false);
  });

  it.each([
    [
      'an export line it cannot read',
      {
        'aliases/suffixed.d.ts': 'export { default as TrashIcon } from "../icons/trash.js";'
      },
      'unrecognised export lines in aliases/suffixed.d.ts'
    ],
    [
      'an alias note without a replacement link',
      {
        'aliases/aliases.d.ts': files['aliases/aliases.d.ts'].replace('{@link Trash}', 'Trash')
      },
      'unrecognised @deprecated notes in aliases/aliases.d.ts'
    ],
    [
      'a replacement that is not exported',
      {
        'aliases/aliases.d.ts': files['aliases/aliases.d.ts'].replace(
          '{@link Trash}',
          '{@link Bin}'
        )
      },
      'no export named Bin'
    ],
    [
      'a removal note whose reason is not on its line',
      { 'icons/swiss-franc.svelte.d.ts': '/**\n * @deprecated\n * Removed.\n */' },
      'no reason after @deprecated in icons/swiss-franc.svelte.d.ts'
    ]
  ])('throws on %s', (_case, overrides, detail) => {
    expect(() => readLucide(dist(overrides))).toThrow(detail);
  });
});
