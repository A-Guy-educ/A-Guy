import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_META,
  DEFAULT_PREFS,
  type NotificationType,
} from '@/ui/cody/notifications/types'

describe('notification types', () => {
  it('NOTIFICATION_META covers all 11 types', () => {
    const types: NotificationType[] = [
      'task-completed',
      'task-failed',
      'task-started',
      'gate-waiting',
      'pr-ready',
      'pr-merged',
      'stage-change',
      'chat-response',
      'task-assigned',
      'retry-started',
      'build-error',
    ]
    for (const t of types) {
      expect(NOTIFICATION_META[t]).toBeDefined()
      expect(NOTIFICATION_META[t].icon).toBeTruthy()
      expect(NOTIFICATION_META[t].label).toBeTruthy()
      expect(['high', 'medium', 'low']).toContain(NOTIFICATION_META[t].priority)
    }
  })

  it('DEFAULT_PREFS has all fields', () => {
    expect(DEFAULT_PREFS.browserEnabled).toBe(true)
    expect(DEFAULT_PREFS.inAppEnabled).toBe(true)
    expect(DEFAULT_PREFS.soundEnabled).toBe(true)
    expect(DEFAULT_PREFS.disabledTypes).toEqual([])
  })
})
