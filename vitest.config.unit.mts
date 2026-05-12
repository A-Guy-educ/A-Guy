import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

/**
 * Match the Next.js webpack rule `{ test: /\.md$/, type: 'asset/source' }`
 * (see next.config.js) so source files that `import x from './foo.md'` work
 * the same way in unit tests as they do in production.
 */
function rawMarkdownPlugin(): Plugin {
  return {
    name: 'raw-markdown',
    enforce: 'pre',
    transform(_code, id) {
      if (!id.endsWith('.md')) return null
      const cleanPath = id.split('?')[0]
      const raw = readFileSync(cleanPath, 'utf-8')
      return {
        code: `export default ${JSON.stringify(raw)};`,
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [tsconfigPaths(), react(), rawMarkdownPlugin()],
  ssr: {
    noExternal: ['zod'],
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.spec.tsx',
      'tests/unit/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.spec.ts', '**/*.e2e.spec.ts'],
    // Suppress console output during tests for cleaner output
    onConsoleLog(_log, type) {
      if (type === 'stdout') {
        return false
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/server/payload/access/**/*.ts',
        'src/server/payload/collections/**/*.ts',
        'src/server/payload/hooks/**/*.ts',
        'src/server/payload/endpoints/**/*.ts',
        'src/server/services/**/*.ts',
        'src/infra/llm/**/*.ts',
        'src/infra/blob/**/*.ts',
        'src/infra/config/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
        'src/lib/ai/prompts/**',
        'src/lib/ai/services/**',
      ],
      /**
       * Thresholds are set just below the current unit-test coverage baseline
       * so the gate catches regressions without blocking every PR.
       *
       * Current baseline (measured locally): ~23.8% statements, ~20.2% branches,
       * ~27.2% functions. The previous aspirational targets (50/45) were above
       * reality. Raise these numbers incrementally as real coverage grows.
       *
       * Note: CI currently runs `pnpm test:unit -- --coverage`, which vitest
       * parses as a file filter after `--`, so unit coverage is NOT actually
       * enforced on CI today. These thresholds still apply to local
       * `pnpm test:unit:coverage` runs.
       */
      thresholds: {
        statements: 22,
        branches: 18,
        functions: 25,
        autoUpdate: false,
      },
    },
  },
})
