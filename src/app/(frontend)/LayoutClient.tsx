/**
 * Frontend Layout Client Component
 *
 * Handles client-side concerns for the frontend layout.
 * Emits system events for other services to subscribe to.
 */

'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { useEffect } from 'react'

export function LayoutClient() {
  // Emit SITE_INIT once on mount
  // Other services (like analytics) subscribe to this event
  useEffect(() => {
    systemEventBus.emit(SYSTEM_EVENTS.SITE_INIT, {})
  }, [])

  return null
}
