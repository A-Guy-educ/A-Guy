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
  formatJsonEvent,
  MAX_RETRIES,
  STABILITY_CHECK_INTERVAL,
  STABILITY_CHECK_COUNT,
  POST_EXIT_DELAY,
  LLM_TIMEOUT,
  DEFAULT_TIMEOUT,
  NUDGE_TIMEOUT,
} from '../../../../scripts/cody/agent-runner'
import type { CodyInput } from '../../../../scripts/cody/cody-utils'

describe('MAX_RETRIES', () => {
  it('should be 2', () => {
    expect(MAX_RETRIES).toBe(2)
  })
})

describe('STABILITY_CHECK_INTERVAL', () => {
  it('should be 500ms', () => {
    expect(STABILITY_CHECK_INTERVAL).toBe(500)
  })
})

describe('STABILITY_CHECK_COUNT', () => {
  it('should be 2 consecutive stable checks', () => {
    expect(STABILITY_CHECK_COUNT).toBe(2)
  })
})

describe('POST_EXIT_DELAY', () => {
  it('should be 500ms', () => {
    expect(POST_EXIT_DELAY).toBe(500)
  })
})

describe('LLM_TIMEOUT', () => {
  it('should be 3 minutes (180000ms)', () => {
    expect(LLM_TIMEOUT).toBe(180000)
  })
})

describe('DEFAULT_TIMEOUT', () => {
  it('should be 10 minutes (600000ms)', () => {
    expect(DEFAULT_TIMEOUT).toBe(600000)
  })
})

describe('NUDGE_TIMEOUT', () => {
  it('should be 90 seconds', () => {
    expect(NUDGE_TIMEOUT).toBe(90)
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

describe('formatJsonEvent', () => {
  it('should format session_start with session ID', () => {
    const line = JSON.stringify({
      type: 'session_start',
      timestamp: 1772693990000,
      sessionID: 'ses_343379bf3ffe4a1b9c2d',
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('🎯 Session started: ses_343379bf3ffe')
    expect(result.sessionId).toBe('ses_343379bf3ffe4a1b9c2d')
  })

  it('should return null display for step_start but still extract sessionId', () => {
    const line = JSON.stringify({
      type: 'step_start',
      timestamp: 1772693991000,
      sessionID: 'ses_abc123def456',
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBeNull()
    expect(result.sessionId).toBe('ses_abc123def456')
  })

  it('should format step_finish with token count, cost, and reason', () => {
    const line = JSON.stringify({
      type: 'step_finish',
      timestamp: 1772693993860,
      sessionID: 'ses_343379bf3ffe4a1b',
      part: {
        id: 'prt_001',
        sessionID: 'ses_343379bf3ffe4a1b',
        messageID: 'msg_001',
        type: 'step-finish',
        reason: 'tool-calls',
        cost: 0.0312,
        tokens: {
          total: 44959,
          input: 1378,
          output: 137,
          reasoning: 0,
        },
      },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  ✅ Step done (44959 tok · $0.0312) [tool-calls]')
    expect(result.sessionId).toBe('ses_343379bf3ffe4a1b')
  })

  it('should include cache info in step_finish when cache.read > 0', () => {
    const line = JSON.stringify({
      type: 'step_finish',
      timestamp: 1772693993860,
      sessionID: 'ses_343379bf3ffe4a1b',
      part: {
        reason: 'tool-calls',
        cost: 0,
        tokens: {
          total: 44959,
          input: 1378,
          output: 137,
          reasoning: 0,
          cache: { read: 42277, write: 1167 },
        },
      },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  ✅ Step done (44959 tok · 42277 cached) [tool-calls]')
    expect(result.sessionId).toBe('ses_343379bf3ffe4a1b')
  })

  it('should format tool_use with completed status', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      timestamp: 1772694011290,
      sessionID: 'ses_343379bf3ffe4a1b',
      part: {
        tool: 'bash',
        state: {
          status: 'completed',
          input: {
            command: 'node -e "console.log(1)"',
            description: 'Test Commander behavior with fresh flag',
          },
          output: 'opts(): {}\n',
          title: 'Test Commander behavior with fresh flag',
          metadata: { output: 'opts(): {}\n', exit: 0, truncated: false },
        },
      },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  🔧 bash: Test Commander behavior with fresh flag')
    expect(result.sessionId).toBe('ses_343379bf3ffe4a1b')
  })

  it('should return null display for tool_use with pending status', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      timestamp: 1772694011000,
      sessionID: 'ses_abc',
      part: { tool: 'bash', state: { status: 'pending' } },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBeNull()
    expect(result.sessionId).toBe('ses_abc')
  })

  it('should return null display for tool_use with running status', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      timestamp: 1772694011000,
      sessionID: 'ses_abc',
      part: { tool: 'bash', state: { status: 'running' } },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBeNull()
  })

  it('should include exit code in tool_use when non-zero', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      timestamp: 1772694011290,
      sessionID: 'ses_xyz',
      part: {
        tool: 'bash',
        state: {
          status: 'completed',
          title: 'Run failing script',
          metadata: { exit: 1 },
        },
      },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  🔧 bash: Run failing script exit=1')
  })

  it('should format text events with agent reasoning', () => {
    const line = JSON.stringify({
      type: 'text',
      timestamp: 1772694000000,
      sessionID: 'ses_abc',
      part: { text: 'Let me read the key files I need to modify' },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  💭 Let me read the key files I need to modify')
    expect(result.sessionId).toBe('ses_abc')
  })

  it('should truncate long text events at 300 chars', () => {
    const longText = 'A'.repeat(350)
    const line = JSON.stringify({
      type: 'text',
      timestamp: 1772694000000,
      sessionID: 'ses_abc',
      part: { text: longText },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  💭 ' + 'A'.repeat(297) + '...')
  })

  it('should return null display for empty text events', () => {
    const line = JSON.stringify({
      type: 'text',
      timestamp: 1772694000000,
      sessionID: 'ses_abc',
      part: { text: '   ' },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBeNull()
    expect(result.sessionId).toBe('ses_abc')
  })

  it('should return null display for text_delta events', () => {
    const line = JSON.stringify({
      type: 'text_delta',
      timestamp: 1772694000000,
      sessionID: 'ses_abc',
      part: { text: 'some streamed text' },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBeNull()
    expect(result.sessionId).toBe('ses_abc')
  })

  it('should format error events', () => {
    const line = JSON.stringify({
      type: 'error',
      timestamp: 1772694000000,
      sessionID: 'ses_err',
      part: { message: 'Rate limit exceeded' },
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBe('  🔴 Error: Rate limit exceeded')
    expect(result.sessionId).toBe('ses_err')
  })

  it('should return null display for unknown event types', () => {
    const line = JSON.stringify({
      type: 'some_future_event',
      timestamp: 1772694000000,
      sessionID: 'ses_unk',
    })
    const result = formatJsonEvent(line)
    expect(result.display).toBeNull()
    expect(result.sessionId).toBe('ses_unk')
  })

  it('should return plain text as-is for invalid JSON', () => {
    const line = 'Some plain text log line from the process'
    const result = formatJsonEvent(line)
    expect(result.display).toBe('Some plain text log line from the process')
    expect(result.sessionId).toBeUndefined()
  })

  it('should return null display for empty lines', () => {
    const result = formatJsonEvent('')
    expect(result.display).toBeNull()
    expect(result.sessionId).toBeUndefined()
  })

  it('should return null display for pino logger JSON (has level/msg but no type)', () => {
    const line = JSON.stringify({
      level: 30,
      time: 1772694000000,
      msg: 'Server started on port 3000',
    })
    const result = formatJsonEvent(line)
    // Pino JSON has no `type` field, so it hits the default case
    expect(result.display).toBeNull()
    expect(result.sessionId).toBeUndefined()
  })
})
