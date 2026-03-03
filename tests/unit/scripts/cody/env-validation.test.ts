import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('getEnv returns typed environment with defaults', async () => {
    // Clear LOG_LEVEL to test default value
    const oldLogLevel = process.env.LOG_LEVEL
    delete process.env.LOG_LEVEL

    const { getEnv, resetEnv } = await import('../../../../scripts/cody/env')
    resetEnv()
    const env = getEnv()

    expect(env.LOG_LEVEL).toBe('info') // default value

    // Restore for other tests
    if (oldLogLevel !== undefined) {
      process.env.LOG_LEVEL = oldLogLevel
    }
  })

  it('getEnv reads actual env vars', async () => {
    process.env.TASK_ID = 'test-task-123'
    const { getEnv, resetEnv } = await import('../../../../scripts/cody/env')
    resetEnv()
    const env = getEnv()
    expect(env.TASK_ID).toBe('test-task-123')
  })

  it('getEnv uses cached value on second call', async () => {
    const { getEnv, resetEnv } = await import('../../../../scripts/cody/env')
    resetEnv()
    const env1 = getEnv()
    const env2 = getEnv()
    expect(env1).toBe(env2) // same reference
  })

  it('resetEnv clears cache', async () => {
    const { getEnv, resetEnv } = await import('../../../../scripts/cody/env')
    resetEnv()
    getEnv()
    resetEnv()
    process.env.TASK_ID = 'changed'
    const env2 = getEnv()
    expect(env2.TASK_ID).toBe('changed')
  })
})
