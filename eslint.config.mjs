import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

// TODO: Enable custom eslint-plugin-aguy once converted to ESM
// The plugin is currently CommonJS and needs to be converted to work with Next.js ESLint
// See eslint-plugin-aguy/README.md for the rules it provides

// Note: eslint-config-next 16.1.1 works correctly, but ESLint 9.39.2 has a bug in error handling
// that crashes when displaying validation errors for configs with circular references.
// This is a known ESLint bug: https://github.com/eslint/eslint/issues/20237
// Using only next/core-web-vitals (which includes TypeScript support) as a workaround.
// Related: https://github.com/vercel/next.js/issues/85244
// TODO: Remove this workaround once ESLint fixes issue #20237
const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
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
]

export default eslintConfig
