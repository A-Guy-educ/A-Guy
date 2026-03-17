// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotificationStore } from '@/ui/cody/notifications/useNotificationStore'

describe('useNotificationStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with empty notifications', () => {
    const { result } = renderHook(() => useNotificationStore())
    expect(result.current.notifications).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })

  it('adds a notification', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-completed', 'Done', 'Task #1 is done', {
        taskIssueNumber: 1,
        taskTitle: 'Task #1',
      })
    })
    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.unreadCount).toBe(1)
    expect(result.current.notifications[0].type).toBe('task-completed')
    expect(result.current.notifications[0].read).toBe(false)
  })

  it('marks a notification as read', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-failed', 'Failed', 'Task failed')
    })
    const id = result.current.notifications[0].id
    act(() => result.current.markAsRead(id))
    expect(result.current.notifications[0].read).toBe(true)
    expect(result.current.unreadCount).toBe(0)
  })

  it('marks all as read', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-completed', 'Done', 'Task 1')
      result.current.addNotification('task-failed', 'Failed', 'Task 2')
    })
    expect(result.current.unreadCount).toBe(2)
    act(() => result.current.markAllAsRead())
    expect(result.current.unreadCount).toBe(0)
  })

  it('clears all notifications', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-completed', 'Done', 'Task 1')
      result.current.addNotification('task-failed', 'Failed', 'Task 2')
    })
    expect(result.current.notifications).toHaveLength(2)
    act(() => result.current.clearAll())
    expect(result.current.notifications).toHaveLength(0)
  })

  it('removes a single notification', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-completed', 'Done', 'Task 1')
      result.current.addNotification('task-failed', 'Failed', 'Task 2')
    })
    const id = result.current.notifications[0].id
    act(() => result.current.removeNotification(id))
    expect(result.current.notifications).toHaveLength(1)
  })

  it('respects disabled types', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => result.current.toggleType('task-started'))
    act(() => {
      const n = result.current.addNotification('task-started', 'Started', 'Task starting')
      expect(n).toBeNull()
    })
    expect(result.current.notifications).toHaveLength(0)
  })

  it('toggleType enables/disables', () => {
    const { result } = renderHook(() => useNotificationStore())
    expect(result.current.isTypeEnabled('stage-change')).toBe(true)
    act(() => result.current.toggleType('stage-change'))
    expect(result.current.isTypeEnabled('stage-change')).toBe(false)
    act(() => result.current.toggleType('stage-change'))
    expect(result.current.isTypeEnabled('stage-change')).toBe(true)
  })

  it('respects inAppEnabled=false', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => result.current.updatePrefs({ inAppEnabled: false }))
    act(() => {
      const n = result.current.addNotification('task-completed', 'Done', 'Task')
      expect(n).toBeNull()
    })
    expect(result.current.notifications).toHaveLength(0)
  })

  it('limits to 50 notifications', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addNotification('task-started', `Task ${i}`, `Body ${i}`)
      }
    })
    expect(result.current.notifications.length).toBeLessThanOrEqual(50)
  })

  it('newest notifications appear first', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-started', 'First', 'Body 1')
    })
    act(() => {
      result.current.addNotification('task-completed', 'Second', 'Body 2')
    })
    expect(result.current.notifications[0].body).toBe('Body 2')
    expect(result.current.notifications[1].body).toBe('Body 1')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => {
      result.current.addNotification('task-completed', 'Done', 'Persisted')
    })
    const raw = localStorage.getItem('cody-notifications')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].body).toBe('Persisted')
  })

  it('persists prefs to localStorage', () => {
    const { result } = renderHook(() => useNotificationStore())
    act(() => result.current.updatePrefs({ soundEnabled: false }))
    const raw = localStorage.getItem('cody-notification-prefs')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.soundEnabled).toBe(false)
  })
})
