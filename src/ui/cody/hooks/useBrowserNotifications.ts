/**
 * @fileType hooks
 * @domain cody
 * @pattern browser-notifications
 * @ai-summary Browser notification hook for task state changes.
 *   Uses useState+useEffect for isSupported/permission to avoid hydration mismatch.
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { CodyTask } from '../types'

interface NotificationOptions {
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
}

interface UseBrowserNotificationsOptions {
  // Callback when permission is denied
  onPermissionDenied?: () => void
  // Callback when notification is clicked
  onNotificationClick?: (task: CodyTask) => void
}

/**
 * Hook to manage browser notifications for task state changes.
 * Tracks task state transitions and sends notifications for important events.
 *
 * IMPORTANT: isSupported and permission use useState (not synchronous checks)
 * so that server and client both render `false`/`'default'` on first pass,
 * avoiding hydration mismatch.
 */
export function useBrowserNotifications({
  onPermissionDenied,
  onNotificationClick: _onNotificationClick,
}: UseBrowserNotificationsOptions = {}) {
  // Start false/default on both server and client to avoid hydration mismatch
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const previousTasksRef = useRef<CodyTask[]>([])
  const tasksRef = useRef<CodyTask[]>([])

  // Detect support after mount (client-only)
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'Notification' in window
    setIsSupported(supported)
    if (supported) {
      setPermission(Notification.permission)
    }
  }, [])

  // Request permission on mount (only if supported) - but don't auto-request
  // Let user click the bell button to request permission
  useEffect(() => {
    if (!isSupported) return

    // Just check current permission status, don't auto-request
    setPermission(Notification.permission)
  }, [isSupported])

  // Send a notification
  const sendNotification = useCallback(
    (title: string, body: string, options?: NotificationOptions) => {
      // Check permission directly from browser API, not React state (may be stale)
      if (!isSupported || Notification.permission !== 'granted') {
        return null
      }

      const notification = new Notification(title, {
        body,
        icon: options?.icon || '/favicon.ico',
        badge: options?.badge,
        tag: options?.tag,
        requireInteraction: options?.requireInteraction,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Play notification sound using Web Audio API (no external file needed)
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const audioContext = new AudioContextClass()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800 // Hz
        oscillator.type = 'sine'
        gainNode.gain.value = 0.3 // Volume

        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.15) // 150ms beep
      } catch {
        // Audio not supported
      }

      return notification
    },
    [isSupported],
  )

  // Request or toggle permission when user clicks the button
  const requestPermission = useCallback(async () => {
    if (!isSupported) return

    if (Notification.permission === 'granted') {
      // Already granted - no way to revoke via API, but we can track "disabled" state
      // User must go to browser settings to revoke
      return
    }

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm === 'denied') {
        onPermissionDenied?.()
      }
    } else {
      setPermission(Notification.permission)

      if (Notification.permission === 'denied') {
        onPermissionDenied?.()
      }
    }
  }, [isSupported, onPermissionDenied])

  // Check for task state changes and send notifications
  const checkTaskChanges = useCallback(
    (tasks: CodyTask[]) => {
      tasksRef.current = tasks
      const previousTasks = previousTasksRef.current

      // On first run, just store the tasks
      if (previousTasks.length === 0) {
        previousTasksRef.current = tasks
        return
      }

      // Create a map of previous tasks by issueNumber
      const previousTaskMap = new Map(previousTasks.map((t) => [t.issueNumber, t]))

      // Check each current task for state changes
      for (const task of tasks) {
        const previousTask = previousTaskMap.get(task.issueNumber)

        // Skip if task wasn't in the previous list
        if (!previousTask) continue

        // Check for column/state transitions
        const prevColumn = previousTask.column
        const currColumn = task.column

        // Gate waiting notification
        if (prevColumn !== 'gate-waiting' && currColumn === 'gate-waiting') {
          sendNotification('🚦 Task Needs Approval', `${task.title}`, {
            tag: `task-${task.issueNumber}`,
          })
        }

        // Failed notification
        if (prevColumn !== 'failed' && currColumn === 'failed') {
          const reason = task.isTimeout
            ? ' (timeout)'
            : task.isExhausted
              ? ' (retries exhausted)'
              : ''
          sendNotification('❌ Task Failed', `${task.title}${reason}`, {
            tag: `task-${task.issueNumber}`,
          })
        }

        // Done notification
        if (prevColumn !== 'done' && currColumn === 'done') {
          sendNotification('✅ Task Completed', `${task.title}`, {
            tag: `task-${task.issueNumber}`,
          })
        }

        // Running notification (started running from not running)
        if (
          (prevColumn === 'open' || prevColumn === 'failed' || prevColumn === 'retrying') &&
          (currColumn === 'building' || currColumn === 'review')
        ) {
          sendNotification('🔄 Task Started', `${task.title}`, { tag: `task-${task.issueNumber}` })
        }
      }

      // Update previous tasks
      previousTasksRef.current = tasks
    },
    [sendNotification],
  )

  return {
    permission,
    sendNotification,
    requestPermission,
    checkTaskChanges,
    isSupported,
  }
}
