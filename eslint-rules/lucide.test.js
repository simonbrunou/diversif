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

const swissFrancReason =
  'Removed because the depicted concept became obsolete and no longer had relevant use cases.';

// These cases run against the installed @lucide/svelte, so they also prove
// that its current files still parse. They name icons that 1.51.0
// deprecates: a Lucide release that drops one fails its case on purpose, and
// the case then moves to another icon that release deprecates.
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
      "import { Trash2 } from '@lucide/lab';",
      "import { Trash2 } from '@lucide/svelte-foo';",
      'const load = (n) => import(`./icons/${n}`);',
      'const load = (n) => import(`@lucide/svelte-foo/${n}`);',
      "const load = (base) => import(base + '/icons/trash-2');",
      "const load = (a) => import(a ? './a' : './b');",
      'const load = () => import(1);',
      "type T = typeof import('@lucide/svelte').Trash;",
      // The barrels have no default export, so TypeScript rejects this one.
      "import Trash2 from '@lucide/svelte';"
    ],
    invalid: [
      {
        code: "import { Trash2, Loader2 as Spin } from '@lucide/svelte';",
        errors: [
          { messageId: 'replaced', data: { name: 'Trash2', replacement: 'Trash' }, column: 10 },
          {
            messageId: 'replaced',
            data: { name: 'Loader2', replacement: 'LoaderCircle' },
            column: 18
          }
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
        code: "export { Trash2 as Bin } from '@lucide/svelte';",
        errors: [
          { messageId: 'replaced', data: { name: 'Trash2', replacement: 'Trash' }, column: 10 }
        ]
      },
      {
        code: "const lazy = (flag) => import(flag ? './x' : '@lucide/svelte/icons/trash-2');",
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
        code: "const lazy = (fallback) => import('@lucide/svelte/icons/trash-2' || fallback);",
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
        code: [
          "import('@lucide/svelte/icons/trash-2' as string);",
          "import('@lucide/svelte/icons/smile' satisfies string);",
          "import('@lucide/svelte/icons/loader-2'!);",
          "import(<string>'@lucide/svelte/icons/check-circle-2');"
        ].join('\n'),
        errors: [
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/trash-2',
              replacement: '@lucide/svelte/icons/trash'
            }
          },
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/smile',
              replacement: '@lucide/svelte/icons/face-slightly-smiling'
            }
          },
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/loader-2',
              replacement: '@lucide/svelte/icons/loader-circle'
            }
          },
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
        code: "const lazy = (flag) => import(flag ? '@lucide/svelte/icons/trash-2' : '@lucide/svelte/icons/trash');",
        errors: [
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/trash-2',
              replacement: '@lucide/svelte/icons/trash'
            },
            column: 38
          }
        ]
      },
      {
        code: "const lazy = (path) => import(path ?? '@lucide/svelte/icons/loader-2');",
        errors: [
          {
            messageId: 'replaced',
            data: {
              name: '@lucide/svelte/icons/loader-2',
              replacement: '@lucide/svelte/icons/loader-circle'
            }
          }
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
            },
            column: 18
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
        code: 'const lazy = () => import(`@lucide/svelte/icons/trash-2`);',
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
        code: "import { 'Trash2' as Bin } from '@lucide/svelte'; export { 'Loader2' as Spin } from '@lucide/svelte';",
        errors: [
          { messageId: 'replaced', data: { name: 'Trash2', replacement: 'Trash' } },
          { messageId: 'replaced', data: { name: 'Loader2', replacement: 'LoaderCircle' } }
        ]
      },
      {
        code: "import { SwissFranc, LucideSwissFranc } from '@lucide/svelte';",
        errors: [
          { messageId: 'removed', data: { name: 'SwissFranc', reason: swissFrancReason } },
          { messageId: 'removed', data: { name: 'LucideSwissFranc', reason: swissFrancReason } }
        ]
      },
      {
        code: "import Franc from '@lucide/svelte/icons/badge-swiss-franc';",
        errors: [
          {
            messageId: 'removed',
            data: { name: '@lucide/svelte/icons/badge-swiss-franc', reason: swissFrancReason }
          }
        ]
      },
      {
        code: "import * as L from '@lucide/svelte';",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte' }, column: 1 }]
      },
      {
        code: "import { icons } from '@lucide/svelte';",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte' } }]
      },
      {
        code: "import { icons } from '@lucide/svelte/icons';",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte/icons' } }]
      },
      {
        code: "import { SwissFranc } from '@lucide/svelte/icons/index';",
        errors: [{ messageId: 'removed', data: { name: 'SwissFranc', reason: swissFrancReason } }]
      },
      {
        code: "type T = typeof import('@lucide/svelte').Trash2;",
        errors: [{ messageId: 'replaced', data: { name: 'Trash2', replacement: 'Trash' } }]
      },
      {
        code: "type T = import('@lucide/svelte/icons/trash-2').default;",
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
        code: "type T = typeof import('@lucide/svelte').icons.Trash2;",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte' } }]
      },
      {
        code: "type T = typeof import('@lucide/svelte/icons');",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte/icons' } }]
      },
      {
        code: "export * from '@lucide/svelte/icons';",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte/icons' }, column: 15 }]
      },
      {
        code: "const lazy = () => import('@lucide/svelte');",
        errors: [{ messageId: 'unnamed', data: { source: '@lucide/svelte' } }]
      },
      {
        code: "const lazy = (a) => import(a ? '@lucide/svelte' : '@lucide/svelte/icons');",
        errors: [
          { messageId: 'unnamed', data: { source: '@lucide/svelte' }, column: 32 },
          { messageId: 'unnamed', data: { source: '@lucide/svelte/icons' }, column: 51 }
        ]
      },
      {
        code: 'const load = (n) => import(`@lucide/svelte/icons/${n}`);',
        errors: [{ messageId: 'computed', column: 28 }]
      },
      {
        code: "const load = (n) => import('@lucide/svelte/' + 'icons/' + n);",
        errors: [{ messageId: 'computed' }]
      },
      {
        code: "const load = (a) => import(`${a ? '@lucide/svelte/icons/trash-2' : './x'}`);",
        errors: [{ messageId: 'computed' }]
      },
      {
        code: "const load = (a) => import((a ? '@lucide/svelte/icons/trash-' : './') + '2');",
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
  'icons/swiss-franc.svelte.d.ts': '/**\n * @deprecated Removed because it became obsolete.\n */',
  // The component carries the same note; only its .svelte.d.ts is read.
  'icons/swiss-franc.svelte': '<!-- @deprecated Removed because it became obsolete. -->'
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
    expect([...deprecatedByFile.keys()].sort()).toEqual(['swiss-franc', 'trash-2']);
  });

  it.each([
    [
      'a file with no export lines',
      { 'aliases/suffixed.d.ts': '' },
      'unrecognised export lines in aliases/suffixed.d.ts'
    ],
    [
      'one export line it cannot read among readable ones',
      {
        'aliases/suffixed.d.ts': [
          files['aliases/suffixed.d.ts'],
          'export { default as SwissFrancIcon } from "../icons/swiss-franc.js";'
        ].join('\n')
      },
      'unrecognised export lines in aliases/suffixed.d.ts'
    ],
    [
      'an aliases file with no @deprecated notes',
      { 'aliases/aliases.d.ts': "export { default as Bin } from '../icons/trash.js';" },
      'unrecognised @deprecated notes in aliases/aliases.d.ts'
    ],
    [
      'one alias note without a replacement link among readable ones',
      {
        'aliases/aliases.d.ts': [
          files['aliases/aliases.d.ts'],
          'export { ',
          '/** @deprecated Renamed, use Trash instead. */',
          "default as Bin } from '../icons/bin.js';"
        ].join('\n')
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
