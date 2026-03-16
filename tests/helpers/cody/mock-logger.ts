/**
 * @fileType test-helper
 * @domain cody | testing
 * @ai-summary Shared mock logger matching pino interface used across cody pipeline
 */

import { vi } from 'vitest'

/**
 * Create a mock logger matching the pino logger interface.
 * Replaces 15+ copy-pasted mock logger objects across cody test files.
 */
export function createMockLogger() {
  const mock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info',
  }
  return mock
}

export type MockLogger = ReturnType<typeof createMockLogger>
