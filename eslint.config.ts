import eslint from '@eslint/js'
import jsdoc from 'eslint-plugin-jsdoc'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-restricted-syntax': [
        'error',
        {
          // Catches `foo as unknown as Bar` double-casts — make functions generic instead.
          selector: 'TSAsExpression > TSAsExpression',
          message:
            "Double cast through 'unknown' hides type errors. Make the function generic or narrow the type properly instead.",
        },
        {
          // `public` class members with an underscore prefix should be `private`.
          // The underscore convention is not a substitute for TypeScript access control.
          selector:
            "PropertyDefinition[accessibility='public'][key.name=/^_/], MethodDefinition[accessibility='public'][key.name=/^_/]",
          message:
            "Member starts with '_' but is declared public. Use 'private' (or 'private readonly') to enforce the boundary at the type level.",
        },
      ],
    },
  },
  {
    // Require JSDoc on all exported symbols in production source files.
    // Test files, config files and examples are intentionally excluded below.
    files: ['packages/*/src/**/*.ts'],
    ignores: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test-helpers.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: [
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
            'TSEnumDeclaration',
            'ExportNamedDeclaration > VariableDeclaration',
          ],
          checkConstructors: false,
          enableFixer: false,
        },
      ],
    },
  },
  {
    // Relax rules for test files.
    // no-non-null-assertion: tests control fixture data; ! is idiomatic when
    // noUncheckedIndexedAccess makes arr[0] return T | undefined.
    files: ['packages/*/src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Relax rules for example files and config files
    files: ['examples/**', '*.config.ts', 'eslint.config.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', '.turbo/**', 'node_modules/**', '**/api.gen.ts'],
  },
)
