import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  ssr: {
    noExternal: [/@payloadcms\/.*/],
  },
  test: {
    environment: 'node',
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
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.spec.ts',
        'src/lib/**/*.test.ts',
        'src/lib/ai/prompts/**',
        'src/lib/ai/services/**', // These need more complex mocking
      ],
    },
    deps: {
      inline: [/@payloadcms\/.*/],
    },
    css: false,
  },
})
