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

  // Server layer - block client and UI imports
  // Note: Payload admin blocks and plugins are exempt - they need UI imports
  {
    name: 'server-boundaries',
    files: ['src/server/**/*.{ts,tsx}'],
    ignores: ['src/server/payload/blocks/**', 'src/server/payload/plugins/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/**', 'src/client/**'],
              message: 'Server layer cannot import from Client layer',
            },
            {
              group: ['@/ui/**', 'src/ui/**'],
              message: 'Server layer cannot import from UI layer',
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

  // =============================================================================
  // Thin App Layer Rules (src/app/**)
  // =============================================================================
  // Block direct Payload usage in src/app/**
  {
    name: 'thin-app-payload-block',
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'payload-import',
          importNames: ['default', 'getPayload'],
          message:
            'Direct Payload access is forbidden in src/app/**. Use @/server/repos/queries/** or @/server/services/**',
        },
        {
          name: 'server-payload-import',
          message: 'Direct Payload access is forbidden in src/app/**',
        },
        {
          name: 'collections-import',
          message: 'Direct collection access is forbidden in src/app/**',
        },
        {
          name: 'fields-import',
          message: 'Direct field access is forbidden in src/app/**',
        },
        {
          name: 'access-import',
          message: 'Direct access control imports are forbidden in src/app/**',
        },
      ],
    },
  },

  // Block repos in route handlers and server actions
  {
    name: 'thin-app-routes-services-only',
    files: ['src/app/**/route.ts', 'src/app/**/actions/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          name: 'repos-in-routes',
          message:
            'Route handlers and server actions must call services only. Use @/server/services/**',
        },
      ],
    },
  },

  // Block heavy transforms (map/filter/reduce/sort) in src/app/**
  // Only blocks transforms within component scope (JSX, function bodies)
  // Allowlist: loading.tsx, error.tsx, not-found.tsx, module-level helper functions
  {
    name: 'thin-app-no-heavy-transforms',
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/**/loading.tsx', 'src/app/**/error.tsx', 'src/app/**/not-found.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Only catch transforms inside JSX (return statements) or variable declarations in function scope
          // Excludes: top-level helper functions, import statements
          selector:
            'CallExpression[callee.type="MemberExpression"][callee.property.name=/^(map|filter|reduce|sort)$/]:not(:scope) :matches(JSXExpressionContainer, VariableDeclarator > CallExpression, Property > CallExpression, ArrayExpression > CallExpression)',
          message:
            'Heavy transforms (map/filter/reduce/sort) are forbidden in src/app/**. Move to src/server/services/**.',
        },
      ],
    },
  },
]

export default eslintConfig
