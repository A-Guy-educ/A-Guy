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

// Custom rule to ban arbitrary hex colors in className
// This catches patterns like bg-[#525659], text-[#...], border-[#...], etc.
// Note: eslint-plugin-tailwindcss is not fully compatible with Tailwind CSS v4.
// See: https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/689
const noArbitraryHexColor = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow arbitrary hex colors in Tailwind className',
      category: 'Possible Errors',
      recommended: false,
    },
    schema: [],
  },
  create(context) {
    const hexColorPattern = /\[[a-z]+-\[#([0-9A-Fa-f]{3,6})\]\]/g

    return {
      JSXAttribute(node) {
        if (node.name.name === 'className' || node.name.name === 'class') {
          if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
            const match = node.value.value.match(hexColorPattern)
            if (match) {
              context.report({
                node,
                message:
                  'Arbitrary hex colors are not allowed. Use design tokens instead (e.g., bg-surface, text-primary).',
              })
            }
          }
        }
      },
      // Also catch string literals in other contexts (e.g., template literals with class strings)
      Literal(node) {
        if (typeof node.value === 'string' && hexColorPattern.test(node.value)) {
          context.report({
            node,
            message:
              'Arbitrary hex colors are not allowed. Use design tokens instead (e.g., bg-surface, text-primary).',
          })
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (hexColorPattern.test(quasi.value.raw)) {
            context.report({
              node: quasi,
              message:
                'Arbitrary hex colors are not allowed. Use design tokens instead (e.g., bg-surface, text-primary).',
            })
            break
          }
        }
      },
    }
  },
}

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: {
      aguy: {
        rules: {
          'no-arbitrary-hex-color': noArbitraryHexColor,
        },
      },
    },
    rules: {
      // Custom rule to ban arbitrary hex colors
      'aguy/no-arbitrary-hex-color': 'error',
    },
  },
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
