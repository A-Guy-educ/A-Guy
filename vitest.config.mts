import { config as loadEnv } from 'dotenv'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.test', override: true })

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'tests/int/**/*.int.spec.ts',
      'tests/int/**/*.int.spec.tsx',
      'tests/unit/**/*.test.ts',
    ],
    hookTimeout: 120000, // 120 seconds for hooks (MongoDB container + Payload init can be slow)
    testTimeout: 10000, // 10 seconds for individual tests
  },
})
