import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/int/scripts/cody.int.spec.ts'],
    testTimeout: 10000,
    onConsoleLog(_log, type) {
      if (type === 'stdout') {
        return false
      }
    },
  },
})
