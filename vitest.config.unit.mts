import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.spec.tsx',
      'tests/unit/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.int.spec.ts', '**/*.e2e.spec.ts'],
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
  },
})
