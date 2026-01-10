import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import nextPlugin from '@next/eslint-plugin-next'

// TODO: Enable custom eslint-plugin-aguy once converted to ESM
// The plugin is currently CommonJS and needs to be converted to work with Next.js ESLint
// See eslint-plugin-aguy/README.md for the rules it provides

// Note: eslint-config-next 16.1.1 works correctly, but ESLint 9.39.2 has a bug in error handling
// that crashes when displaying validation errors for configs with circular references.
// This is a known ESLint bug: https://github.com/eslint/eslint/issues/20237
// Workaround: Use typescript-eslint's flat config directly instead of compat.extends().
// This avoids triggering the validator's JSON.stringify on circular references.
// Related: https://github.com/vercel/next.js/issues/85244
// TODO: Remove this workaround once ESLint fixes issue #20237

// Manual configuration based on next/core-web-vitals to avoid circular reference bug
// Use typescript-eslint's recommended config as base, then add React and Next.js plugins
const nextConfig = [
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@next/next': nextPlugin,
    },
    rules: {
      // React hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // React refresh rule
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Next.js core web vitals rules
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'error',
      '@next/next/no-unwanted-polyfillio': 'error',
      '@next/next/no-page-custom-font': 'error',
      '@next/next/no-css-tags': 'error',
      '@next/next/no-head-element': 'error',
      '@next/next/no-sync-scripts': 'error',
      '@next/next/no-before-interactive-script-outside-document': 'error',
      '@next/next/no-duplicate-head': 'error',
      '@next/next/no-head-import-in-document': 'error',
      '@next/next/no-script-component-in-head': 'error',
      '@next/next/google-font-display': 'warn',
      '@next/next/google-font-preconnect': 'warn',
      '@next/next/inline-script-id': 'error',
      '@next/next/next-script-for-ga': 'warn',
    },
  },
]

const eslintConfig = [
  ...nextConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // TypeScript rules (override/extend what's in nextConfig)
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

      // React hooks rules are already defined in nextConfig, no need to duplicate

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
