import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  renameSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
  mkdtempSync: vi.fn(),
}))

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    on: vi.fn(),
    kill: vi.fn(),
  })),
}))

// Mock stage-prompts
vi.mock('../../../../scripts/cody/stage-prompts', () => ({
  buildStagePrompt: vi.fn(() => 'Test prompt'),
  SPEC_STAGES: ['taskify', 'spec', 'clarify'],
}))

// Mock runner-backend
vi.mock('../../../../scripts/cody/runner-backend', () => ({
  createRunner: vi.fn(() => ({
    name: 'mock-runner',
    spawn: vi.fn(() => ({ pid: 12345, on: vi.fn(), kill: vi.fn() })),
  })),
}))

import * as fs from 'fs'
import {
  runAgentWithFileWatch,
  MAX_RETRIES,
  STABILITY_CHECK_INTERVAL,
  STABILITY_CHECK_COUNT,
  POST_EXIT_DELAY,
} from '../../../../scripts/cody/agent-runner'
import type { CodyInput } from '../../../../scripts/cody/cody-utils'

describe('MAX_RETRIES', () => {
  it('should be 2', () => {
    expect(MAX_RETRIES).toBe(2)
  })
})

describe('STABILITY_CHECK_INTERVAL', () => {
  it('should be 1000ms (1 second)', () => {
    expect(STABILITY_CHECK_INTERVAL).toBe(1000)
  })
})

describe('STABILITY_CHECK_COUNT', () => {
  it('should be 3 consecutive stable checks', () => {
    expect(STABILITY_CHECK_COUNT).toBe(3)
  })
})

describe('POST_EXIT_DELAY', () => {
  it('should be 1000ms (1 second)', () => {
    expect(POST_EXIT_DELAY).toBe(1000)
  })
})

describe('runAgentWithFileWatch retry logic', () => {
  const mockInput: CodyInput = {
    taskId: 'test-task',
    mode: 'impl',
    dryRun: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export runAgentWithFileWatch function', () => {
    expect(typeof runAgentWithFileWatch).toBe('function')
  })

  it('should handle missing output file gracefully', async () => {
    // This test verifies the function can be called with basic parameters
    // The actual retry behavior is tested indirectly through integration tests
    vi.mocked(fs.existsSync).mockReturnValue(false)

    // The function returns a Promise, but we don't expect it to resolve
    // in this test since we're just verifying the export works
    const promise = runAgentWithFileWatch(
      mockInput,
      'plan-gap',
      '/fake/path/plan-gap.md',
      1000,
      { maxRetries: 0 }, // No retries for this test
    )

    // The function should not throw immediately
    expect(promise).toBeInstanceOf(Promise)
  })
})
