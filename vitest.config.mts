import react from '@vitejs/plugin-react'
import { config as loadEnv } from 'dotenv'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    fileParallelism: true, // Run test files in parallel for faster execution (shared MongoDB container enables this)
    pool: 'forks', // Use forks pool for better isolation
    globalSetup: ['./tests/setup/global-int-setup.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts', 'tests/int/**/*.int.spec.tsx'],
    hookTimeout: 180000, // 180 seconds for hooks (cleanup operations may be slow)
    testTimeout: 30000, // 30 seconds for individual tests (Vercel Blob and network-dependent tests may be slow)
    // Suppress console output during tests for cleaner output
    onConsoleLog(_log, type) {
      if (type === 'stdout') {
        return false
      }
    },
    maxConcurrency: 4, // Allow up to 4 tests to run concurrently
    outputFile: undefined, // Don't write to file (reduces I/O noise)
  },
})
