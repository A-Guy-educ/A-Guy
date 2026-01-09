import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

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
    hookTimeout: 60000, // 60 seconds for hooks (Payload initialization can be slow in CI)
    testTimeout: 10000, // 10 seconds for individual tests
  },
})
