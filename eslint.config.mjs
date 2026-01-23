import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

// TODO: Enable custom eslint-plugin-aguy once converted to ESM
// The plugin is currently CommonJS and needs to be converted to work with Next.js ESLint
// See eslint-plugin-aguy/README.md for the rules it provides

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // TypeScript rules
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],

      // React hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TODO: Custom A-Guy platform rules (pending plugin ESM conversion)
      // 'aguy/require-collection-access': 'error',
      // 'aguy/no-nested-metadata': 'error',
      // 'aguy/tailwind-only-components': 'warn',
      // 'aguy/require-auth-endpoints': 'error',
    },
  },
  {
    ignores: ['.next/', 'node_modules/', '.cache/', 'dist/', 'build/', 'coverage/'],
  },

  // =============================================================================
  // Layer Boundary Rules
  // =============================================================================
  // UI layer - block server/services and server/repos imports (payload/ allowed)
  {
    name: 'ui-boundaries',
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/services/**', 'src/server/services/**'],
              message: 'UI layer cannot import from Server Services (business logic)',
            },
            {
              group: ['@/server/repos/**', 'src/server/repos/**'],
              message: 'UI layer cannot import from Server Repos (data access)',
            },
          ],
        },
      ],
    },
  },

  // Client layer - block server imports
  {
    name: 'client-boundaries',
    files: ['src/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/**', 'src/server/**'],
              message: 'Client layer cannot import from Server layer',
            },
          ],
        },
      ],
    },
  },

  // Infra layer - leaf node, cannot import from other layers
  {
    name: 'infra-boundaries',
    files: ['src/infra/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/**', 'src/client/**'],
              message: 'Infra layer cannot import from Client layer',
            },
            {
              group: ['@/ui/**', 'src/ui/**'],
              message: 'Infra layer cannot import from UI layer',
            },
            {
              group: ['@/server/services/**', 'src/server/services/**'],
              message: 'Infra layer cannot import from Server Services',
            },
            {
              group: ['@/server/repos/**', 'src/server/repos/**'],
              message: 'Infra layer cannot import from Server Repos',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
