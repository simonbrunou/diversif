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
    files: ['**/*.svelte'],
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
      'svelte/valid-compile': ['error', { ignoreWarnings: true }]
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
