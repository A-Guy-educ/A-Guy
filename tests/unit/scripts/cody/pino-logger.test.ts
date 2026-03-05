import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pino before importing
vi.mock('pino', () => {
  const child = vi.fn().mockReturnThis()
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child,
    level: 'info',
  }
  const pino = vi.fn(() => mockLogger)
  return { default: pino, pino }
})

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports logger and createStageLogger', async () => {
    const mod = await import('../../../../scripts/cody/logger')
    expect(mod.logger).toBeDefined()
    expect(mod.createStageLogger).toBeDefined()
  })

  it('createStageLogger creates child with stage context', async () => {
    const mod = await import('../../../../scripts/cody/logger')
    mod.createStageLogger('build', 'task-123')
    expect(mod.logger.child).toHaveBeenCalledWith({ stage: 'build', taskId: 'task-123' })
  })
})
