/**
 * System Event Bus
 *
 * Client-side pub/sub event bus with schema validation, SSR guard, and error isolation.
 * Exports only `systemEventBus` - use this singleton for all event operations.
 */

import { eventSchemas } from './schemas'
import type {
  AnySystemEventHandler,
  SystemEventEnvelope,
  SystemEventHandler,
  SystemEventName,
  SystemEventPayloads,
  Unsubscribe,
} from './types'

// Centralized version constant
const BUS_VERSION = 'v0' as const

// Session storage key for session ID
const SESSION_KEY = 'system_events_session_id'

/**
 * Get or create session ID from sessionStorage.
 * Gracefully handles sessionStorage errors (e.g., private browsing).
 */
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    let sessionId = window.sessionStorage.getItem(SESSION_KEY)

    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      window.sessionStorage.setItem(SESSION_KEY, sessionId)
    }

    return sessionId
  } catch {
    // Graceful fallback if sessionStorage is unavailable
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Get current route from window.location.
 */
function getCurrentRoute(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  return window.location.pathname
}

// Handler storage - weak maps for memory efficiency
// Using unknown payload type to avoid complex generic conflicts
type SpecificHandler = (envelope: SystemEventEnvelope<unknown>) => void
type HandlersMap = Map<SystemEventName, Set<SpecificHandler>>
type AnyHandlersSet = Set<AnySystemEventHandler>

const handlers: HandlersMap = new Map()
const anyHandlers: AnyHandlersSet = new Set()

/**
 * Create an envelope with validated payload and metadata.
 */
function createEnvelope<E extends SystemEventName>(
  event: E,
  payload: SystemEventPayloads[E],
): SystemEventEnvelope<SystemEventPayloads[E]> {
  return {
    name: event,
    payload,
    meta: {
      timestamp: Date.now(),
      session_id: getSessionId(),
      route: getCurrentRoute(),
      bus_version: BUS_VERSION,
    },
  }
}

/**
 * Validate payload against schema.
 * Throws in development, warns in production on invalid payload.
 */
function validatePayload<E extends SystemEventName>(
  event: E,
  payload: unknown,
): asserts payload is SystemEventPayloads[E] {
  const schema = eventSchemas[event]
  const result = schema.safeParse(payload)

  if (!result.success) {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`[SystemEvents] Invalid payload for ${event}: ${result.error.message}`)
    } else {
      console.warn(`[SystemEvents] Invalid payload for ${event}`, result.error.issues)
    }
  }
}

/**
 * Deliver envelope to all registered handlers.
 * Errors in individual handlers are isolated - other handlers still receive the event.
 */
function deliverToHandlers(envelope: SystemEventEnvelope<unknown>): void {
  // Deliver to specific event handlers
  const eventHandlers = handlers.get(envelope.name)
  if (eventHandlers) {
    for (const handler of eventHandlers) {
      try {
        handler(envelope)
      } catch (error) {
        console.error(`[SystemEvents] Handler error for ${envelope.name}:`, error)
      }
    }
  }

  // Deliver to any-handlers (catch-all)
  for (const handler of anyHandlers) {
    try {
      handler(envelope)
    } catch (error) {
      console.error(`[SystemEvents] AnyHandler error:`, error)
    }
  }
}

/**
 * System Event Bus interface.
 */
export interface SystemEventBus {
  emit<E extends SystemEventName>(event: E, payload: SystemEventPayloads[E]): void
  on<E extends SystemEventName>(event: E, handler: SystemEventHandler<E>): Unsubscribe
  onAny(handler: AnySystemEventHandler): Unsubscribe
  /** @internal - For testing purposes only */
  reset(): void
}

/**
 * The singleton event bus instance.
 * Use this for all event operations:
 *
 * ```typescript
 * import { systemEventBus, SYSTEM_EVENTS } from '@/infra/system-events'
 *
 * // Emit an event
 * systemEventBus.emit(SYSTEM_EVENTS.PAGE_VIEWED, { page_path: '/courses' })
 *
 * // Subscribe to an event
 * const unsubscribe = systemEventBus.on(SYSTEM_EVENTS.SESSION_STARTED, (envelope) => {
 *   console.log('Session started:', envelope.meta.session_id)
 * })
 * ```
 */
export const systemEventBus: SystemEventBus = {
  emit<E extends SystemEventName>(event: E, payload: SystemEventPayloads[E]): void {
    // SSR guard - no-op on server
    if (typeof window === 'undefined') {
      return
    }

    // Validate payload before emitting
    validatePayload(event, payload)

    // Create envelope with metadata
    const envelope = createEnvelope(event, payload)

    // Deliver to handlers
    deliverToHandlers(envelope)
  },

  on<E extends SystemEventName>(event: E, handler: SystemEventHandler<E>): Unsubscribe {
    // SSR guard - return no-op unsubscribe
    if (typeof window === 'undefined') {
      return () => {}
    }

    // Get or create handler set for this event
    let eventHandlers = handlers.get(event)
    if (!eventHandlers) {
      eventHandlers = new Set()
      handlers.set(event, eventHandlers)
    }

    // Add handler
    eventHandlers.add(handler as unknown as SpecificHandler)

    // Return unsubscribe function
    return () => {
      eventHandlers?.delete(handler as unknown as SpecificHandler)
    }
  },

  onAny(handler: AnySystemEventHandler): Unsubscribe {
    // SSR guard - return no-op unsubscribe
    if (typeof window === 'undefined') {
      return () => {}
    }

    // Add handler to any-handlers set
    anyHandlers.add(handler)

    // Return unsubscribe function
    return () => {
      anyHandlers.delete(handler)
    }
  },

  reset(): void {
    // Clear all handlers - for testing purposes only
    handlers.clear()
    anyHandlers.clear()
  },
}

// Export bus version for debugging
export { BUS_VERSION }
