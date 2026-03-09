import tsconfigPaths from 'vite-tsconfig-paths'
import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/int/external/**/*.int.spec.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
    // Suppress console output during tests for cleaner output
    onConsoleLog(_log, type) {
      if (type === 'stdout') {
        return false
      }
    },
  },
})
