/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern bugfix-tests
 * @ai-summary Tests for third round of bug fixes applied to the Cody pipeline
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// HIGH 7: writeState with fsync (runtime behavioral test)
// ============================================================================

describe('HIGH 7: writeState with fsync before rename', () => {
  it('writeState should work correctly with real filesystem', async () => {
    const { writeState, loadState } = await import('../../../../scripts/cody/engine/status')

    const taskId = 'test-fsync-' + Date.now()
    const taskDir = path.join(process.cwd(), '.tasks', taskId)
    fs.mkdirSync(taskDir, { recursive: true })

    try {
      const state = {
        version: 2 as const,
        taskId,
        mode: 'full',
        pipeline: 'spec_execute_verify' as const,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'running' as const,
        cursor: null,
        stages: {},
      }

      writeState(taskId, state)

      // Verify the file was written correctly
      const loaded = loadState(taskId)
      expect(loaded).not.toBeNull()
      expect(loaded!.taskId).toBe(taskId)
      expect(loaded!.state).toBe('running')
    } finally {
      // Cleanup
      fs.rmSync(taskDir, { recursive: true, force: true })
    }
  })
})
