import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 30,
      },
    },
  },
})
