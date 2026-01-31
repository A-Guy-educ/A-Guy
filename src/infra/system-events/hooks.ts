/**
 * System Events React Hook
 *
 * React hook for subscribing to system events in client components.
 */

import { useCallback, useEffect, useRef } from 'react'

import { systemEventBus } from './bus'
import { SYSTEM_EVENTS } from './events'
import type { SystemEventEnvelope, SystemEventName, SystemEventPayloads } from './types'

type EventHandler<E extends SystemEventName> = (
  envelope: SystemEventEnvelope<SystemEventPayloads[E]>,
) => void

/**
 * Hook to subscribe to a specific system event.
 *
 * ```typescript
 * import { useSystemEvent, SYSTEM_EVENTS } from '@/infra/system-events'
 *
 * function MyComponent() {
 *   useSystemEvent(SYSTEM_EVENTS.LESSON_STARTED, (envelope) => {
 *     console.log('Lesson started:', envelope.payload.lesson_id)
 *   })
 * }
 * ```
 */
export function useSystemEvent<E extends SystemEventName>(
  event: E,
  handler: EventHandler<E>,
): void {
  const handlerRef = useRef(handler)

  // Keep handler ref current for cleanup
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const unsubscribe = systemEventBus.on(event, (envelope) => {
      handlerRef.current(envelope as SystemEventEnvelope<SystemEventPayloads[E]>)
    })

    return unsubscribe
  }, [event])
}

/**
 * Hook to subscribe to all system events (catch-all).
 *
 * ```typescript
 * import { useSystemEventAny } from '@/infra/system-events'
 *
 * function MyComponent() {
 *   useSystemEventAny((envelope) => {
 *     console.log('Event received:', envelope.name)
 *   })
 * }
 * ```
 */
export function useSystemEventAny(handler: (envelope: SystemEventEnvelope<unknown>) => void): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const unsubscribe = systemEventBus.onAny((envelope) => {
      handlerRef.current(envelope)
    })

    return unsubscribe
  }, [])
}

/**
 * Hook to emit events from a component.
 * Provides a stable emit function that doesn't change across renders.
 *
 * ```typescript
 * import { useEmitSystemEvent } from '@/infra/system-events'
 *
 * function MyComponent() {
 *   const emit = useEmitSystemEvent()
 *
 *   const handleClick = () => {
 *     emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/custom' })
 *   }
 * }
 * ```
 */
export function useEmitSystemEvent() {
  return useCallback((event: SystemEventName, payload: SystemEventPayloads[typeof event]) => {
    systemEventBus.emit(event, payload)
  }, [])
}

// Export constants for convenience
export { SYSTEM_EVENTS }
