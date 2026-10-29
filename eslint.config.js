import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import drizzle from 'eslint-plugin-drizzle';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import lucide from './eslint-rules/lucide.js';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    // eslint-plugin-svelte v3 also lints .svelte.ts/.svelte.js runes modules
    // with svelte-eslint-parser; point it at the TS parser so type syntax
    // (e.g. `export type …`) parses instead of throwing "Unexpected token".
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: ts.parser }
    }
  },
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'dist/',
      'drizzle/',
      'data/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      '.e2e-data/',
      'static/',
      'project.inlang/modules/',
      // paraglide 2.x compiler output: every generated module starts with
      // /* eslint-disable */, which trips reportUnusedDisableDirectives as
      // hundreds of warnings. Generated code isn't ours to lint.
      'src/lib/paraglide/'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      // eslint-plugin-svelte v3 turns this on by default. It wants every link
      // and goto() to go through SvelteKit's resolve(), but diversif routes
      // through localizedHref() for the paraglide /en/ locale prefix — which
      // resolve() can't express — so the rule fights the i18n routing.
      'svelte/no-navigation-without-resolve': 'off'
    }
  },
  {
    plugins: { lucide },
    rules: { 'lucide/no-deprecated-icons': 'error' }
  },
  {
    files: ['**/*.svelte'],
    rules: {
      // We never compile to custom elements, so the rest-prop warning is noise.
      'svelte/valid-compile': ['error', { ignoreWarnings: true }],
      // Also new in v3: flags every `new Map()`/`new Set()` in a component as
      // non-reactive. We use plain Maps for local, non-reactive computation
      // (e.g. grouping a list before render); reactive state never lives in a
      // bare Map here. Disable rather than churn to SvelteMap needlessly.
      'svelte/prefer-svelte-reactivity': 'off'
    }
  },
  {
    // An inline `setMonth(getMonth() - n)` rolls over at a month's end: on
    // 29 October, 8 months back is 29 February, read as 1 March, and the child
    // is a month younger (#563). birthDateMonthsAgo clamps the day instead.
    files: ['e2e/**/*.ts'],
    ignores: ['e2e/_helpers.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // `.name` for d.setMonth(), `.value` for d['setMonth']().
          selector:
            'CallExpression:matches([callee.property.name=/^set(UTC)?Month$/], [callee.property.value=/^set(UTC)?Month$/])',
          message:
            'Get a birth date from birthDateMonthsAgo in e2e/_helpers.ts: it clamps the day to the end of a shorter month (#563).'
        }
      ]
    }
  },
  {
    files: ['src/lib/server/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    plugins: { drizzle },
    rules: {
      'drizzle/enforce-delete-with-where': ['error', { drizzleObjectName: ['db', 'tx'] }],
      'drizzle/enforce-update-with-where': ['error', { drizzleObjectName: ['db', 'tx'] }]
    }
  }
);
