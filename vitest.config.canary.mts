import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/canary/**/*.test.ts'],
    testTimeout: 30_000,
    onConsoleLog(_log, type) {
      // Suppress stdout noise from pipeline logger during canary tests
      if (type === 'stdout') {
        return false
      }
    },
  },
})
