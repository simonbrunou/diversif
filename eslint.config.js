import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import drizzle from 'eslint-plugin-drizzle';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

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
      'project.inlang/modules/'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['**/*.svelte'],
    rules: {
      // We never compile to custom elements, so the rest-prop warning is noise.
      'svelte/valid-compile': ['error', { ignoreWarnings: true }],
      // eslint-plugin-svelte v3 turns this on by default. It wants every link to
      // go through SvelteKit's resolve(), but diversif routes through
      // localizedHref() for the paraglide /en/ locale prefix — which resolve()
      // can't express — so the rule fights the i18n routing. Disable it.
      'svelte/no-navigation-without-resolve': 'off',
      // Also new in v3: flags every `new Map()`/`new Set()` in a component as
      // non-reactive. We use plain Maps for local, non-reactive computation
      // (e.g. grouping a list before render); reactive state never lives in a
      // bare Map here. Disable rather than churn to SvelteMap needlessly.
      'svelte/prefer-svelte-reactivity': 'off'
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
