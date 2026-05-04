import nextPlugin from '@next/eslint-plugin-next'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import aguyPlugin from './eslint-plugin-aguy/index.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const eslintConfig = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
  },
  nextPlugin.configs['core-web-vitals'],
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooksPlugin,
    },
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
    },
  },

  // Custom A-Guy platform rules
  {
    plugins: { aguy: aguyPlugin },
    files: ['src/server/payload/collections/**/*.{ts,tsx}'],
    rules: {
      'aguy/require-collection-access': 'error',
    },
  },
  {
    plugins: { aguy: aguyPlugin },
    files: ['scripts/cody/**/*.ts'],
    rules: {
      'aguy/no-exec-sync': 'error',
    },
  },
  {
    plugins: { aguy: aguyPlugin },
    files: ['src/ui/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
    rules: {
      'aguy/tailwind-only-components': 'off',
      'aguy/prefer-design-tokens': 'warn',
    },
  },

  {
    ignores: [
      '.next/',
      'node_modules/',
      '.cache/',
      'dist/',
      'build/',
      'coverage/',
      'src/app/(payload)/custom.scss',
      '*.config.*',
      'scripts/**',
      'eslint-plugin-aguy/**',
      'tailwind.tokens.mjs',
      '.claude/scripts/**',
      'next-env.d.ts',
    ],
  },

  // =============================================================================
  // Console Rules
  // =============================================================================
  // no-console — warn in staging, error after cleanup (blocked by --max-warnings=0 in lint-staged)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: [
      'src/infra/qa/**', // QA dev tools - console expected
      'src/infra/utils/test/**', // Test utilities
      'src/infra/analytics/**', // Client-side analytics with own debugMode
      'src/infra/system-events/**', // Client-side event bus
      'src/ui/**', // Client-side React components
      'src/app/(frontend)/**', // Client-side Next.js pages
      'src/client/**', // Client-side hooks/state
    ],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // =============================================================================
  // Layer Boundary Rules
  // =============================================================================
  // UI layer - block server/services and server/repos imports (payload/ allowed)
  // Exception: chat hooks use @/server/services/api (client-safe API abstraction)
  {
    name: 'ui-boundaries',
    files: ['src/ui/**/*.{ts,tsx}'],
    ignores: ['src/ui/web/chat/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/services/*', '@/server/services/**'],
              message: 'UI layer cannot import from Server Services (business logic)',
            },
            {
              group: ['@/server/repos/*', '@/server/repos/**'],
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
              group: ['@/server/*', '@/server/**'],
              message: 'Client layer cannot import from Server layer',
            },
          ],
        },
      ],
    },
  },

  // Server layer - block client and UI imports
  // Note: Payload admin blocks, plugins, and collections are exempt - they need UI imports for admin UI
  {
    name: 'server-boundaries',
    files: ['src/server/**/*.{ts,tsx}'],
    ignores: [
      'src/server/payload/blocks/**',
      'src/server/payload/plugins/**',
      'src/server/payload/collections/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/*', '@/client/**'],
              message: 'Server layer cannot import from Client layer',
            },
            {
              group: ['@/ui/*', '@/ui/**'],
              message: 'Server layer cannot import from UI layer',
            },
          ],
        },
      ],
    },
  },

  // Infra layer - leaf node, cannot import from other layers
  // Exceptions:
  //   - infra/config/runtime needs getDefaultTenantId for config bootstrapping
  //   - infra/llm needs server repos/services for tenant resolution and media processing
  {
    name: 'infra-boundaries',
    files: ['src/infra/**/*.{ts,tsx}'],
    ignores: ['src/infra/config/runtime/**', 'src/infra/llm/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/*', '@/client/**'],
              message: 'Infra layer cannot import from Client layer',
            },
            {
              group: ['@/ui/*', '@/ui/**'],
              message: 'Infra layer cannot import from UI layer',
            },
            {
              group: ['@/server/services/*', '@/server/services/**'],
              message: 'Infra layer cannot import from Server Services',
            },
            {
              group: ['@/server/repos/*', '@/server/repos/**'],
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
  // Block direct Payload usage in src/app/** (client components, shared utils)
  // Exceptions:
  //   - Server components (page.tsx, layout.tsx), route handlers, and server actions use getPayload
  //   - Payload blocks (RenderBlocks, RelatedPosts) are UI components housed under server/payload
  {
    name: 'thin-app-payload-block',
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: [
      'src/app/**/page.tsx',
      'src/app/**/layout.tsx',
      'src/app/**/route.ts',
      'src/app/**/*-action.ts',
      'src/app/**/*-action.tsx',
      'src/app/**/actions/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'payload',
              importNames: ['getPayload'],
              message: 'Direct Payload access is forbidden in src/app/**. Use @/server/services/**',
            },
          ],
          patterns: [
            {
              group: [
                '@/server/payload/*',
                '@/server/payload/**',
                '!@/server/payload/blocks/*',
                '!@/server/payload/blocks/**',
              ],
              message: 'Direct Payload internals are forbidden in src/app/**',
            },
          ],
        },
      ],
    },
  },

  // Block repos in route handlers and server actions
  // Exception: Some routes use lightweight repo queries directly (tenant lookup, simple queries)
  {
    name: 'thin-app-routes-services-only',
    files: ['src/app/**/route.ts', 'src/app/**/actions/**'],
    ignores: [
      'src/app/api/blob/**',
      'src/app/api/study-plan/**',
      'src/app/api/chapters/**',
      'src/app/api/progress/**',
      'src/app/api/course-syllabus/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/repos/*', '@/server/repos/**'],
              message:
                'Route handlers and server actions must call services only. Use @/server/services/**',
            },
          ],
        },
      ],
    },
  },
]

export default eslintConfig
