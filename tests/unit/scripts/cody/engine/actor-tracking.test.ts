/**
 * Unit tests for actor audit trail in pipeline status tracking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PipelineStateV2, ActorEvent } from '../../../../../scripts/cody/engine/types'

// Mock filesystem operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  openSync: vi.fn(() => 1),
  writeSync: vi.fn(),
  fdatasyncSync: vi.fn(),
  closeSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

describe('appendActorEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appends an actor event to empty actorHistory', async () => {
    const { appendActorEvent } = await import('../../../../../scripts/cody/engine/status')

    const state: PipelineStateV2 = {
      version: 2,
      taskId: 'test-task-001',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      state: 'running',
      cursor: null,
      stages: {},
    }

    const event: ActorEvent = {
      action: 'gate-approved',
      actor: 'aguyaharonyair',
      timestamp: '2026-01-01T01:00:00Z',
      stage: 'taskify',
    }

    const newState = appendActorEvent('test-task-001', state, event)

    expect(newState.actorHistory).toHaveLength(1)
    expect(newState.actorHistory![0].action).toBe('gate-approved')
    expect(newState.actorHistory![0].actor).toBe('aguyaharonyair')
    expect(newState.actorHistory![0].stage).toBe('taskify')
  })

  it('appends to existing actorHistory', async () => {
    const { appendActorEvent } = await import('../../../../../scripts/cody/engine/status')

    const existingEvent: ActorEvent = {
      action: 'pipeline-triggered',
      actor: 'alice',
      timestamp: '2026-01-01T00:00:00Z',
    }

    const state: PipelineStateV2 = {
      version: 2,
      taskId: 'test-task-002',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      state: 'running',
      cursor: null,
      stages: {},
      actorHistory: [existingEvent],
    }

    const newEvent: ActorEvent = {
      action: 'gate-approved',
      actor: 'bob',
      timestamp: '2026-01-01T01:00:00Z',
      stage: 'architect',
    }

    const newState = appendActorEvent('test-task-002', state, newEvent)

    expect(newState.actorHistory).toHaveLength(2)
    expect(newState.actorHistory![0].actor).toBe('alice')
    expect(newState.actorHistory![1].actor).toBe('bob')
  })

  it('caps actorHistory at 50 entries (oldest dropped)', async () => {
    const { appendActorEvent } = await import('../../../../../scripts/cody/engine/status')

    // Create 50 existing events
    const existingEvents: ActorEvent[] = Array.from({ length: 50 }, (_, i) => ({
      action: 'gate-approved',
      actor: `user-${i}`,
      timestamp: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z`,
    }))

    const state: PipelineStateV2 = {
      version: 2,
      taskId: 'test-task-003',
      mode: 'full',
      pipeline: 'spec_execute_verify',
      startedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      state: 'running',
      cursor: null,
      stages: {},
      actorHistory: existingEvents,
    }

    const newEvent: ActorEvent = {
      action: 'pipeline-triggered',
      actor: 'newest-user',
      timestamp: '2026-01-02T00:00:00Z',
    }

    const newState = appendActorEvent('test-task-003', state, newEvent)

    // Should still be capped at 50
    expect(newState.actorHistory).toHaveLength(50)
    // Oldest (user-0) should be dropped, newest should be last
    expect(newState.actorHistory![49].actor).toBe('newest-user')
    expect(newState.actorHistory![0].actor).toBe('user-1')
  })
})

describe('initState with actor', () => {
  it('records triggeredBy and actorHistory when actor is set', async () => {
    const { initState } = await import('../../../../../scripts/cody/engine/status')

    const mockBackend = { name: 'test', spawn: vi.fn() }
    const ctx = {
      taskId: 'test-init-actor',
      taskDir: '/tmp/test-init-actor',
      input: {
        mode: 'full' as const,
        taskId: 'test-init-actor',
        dryRun: false,
        issueNumber: 42,
        actor: 'aguyaharonyair',
      },
      taskDef: null,
      profile: 'standard' as const,
      backend: mockBackend,
      actor: 'aguyaharonyair',
    }

    const state = initState(ctx, 'full')

    expect(state.triggeredBy).toBe('aguyaharonyair')
    expect(state.actorHistory).toHaveLength(1)
    expect(state.actorHistory![0].action).toBe('pipeline-triggered')
    expect(state.actorHistory![0].actor).toBe('aguyaharonyair')
  })

  it('does not set triggeredBy or actorHistory when actor is not set', async () => {
    const { initState } = await import('../../../../../scripts/cody/engine/status')

    const mockBackend = { name: 'test', spawn: vi.fn() }
    const ctx = {
      taskId: 'test-init-no-actor',
      taskDir: '/tmp/test-init-no-actor',
      input: {
        mode: 'full' as const,
        taskId: 'test-init-no-actor',
        dryRun: false,
      },
      taskDef: null,
      profile: 'standard' as const,
      backend: mockBackend,
    }

    const state = initState(ctx, 'full')

    expect(state.triggeredBy).toBeUndefined()
    expect(state.actorHistory).toBeUndefined()
  })
})
