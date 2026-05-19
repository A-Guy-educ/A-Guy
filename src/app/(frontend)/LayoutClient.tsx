/**
 * Frontend Layout Client Component
 *
 * Handles client-side concerns for the frontend layout.
 * Emits system events for other services to subscribe to.
 */

'use client'

import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { restoreAccent } from '@/ui/web/components/accent-picker'
import { useEffect, useState } from 'react'

import { FloatingAgentButton } from '@/ui/web/learning-agent/FloatingAgentButton'
import { AgentChatWindow } from '@/ui/web/learning-agent/AgentChatWindow'

export function LayoutClient() {
  const [isAgentChatOpen, setIsAgentChatOpen] = useState(false)

  // Emit SITE_INIT once on mount
  // Other services (like analytics) subscribe to this event
  useEffect(() => {
    systemEventBus.emit(SYSTEM_EVENTS.SITE_INIT, {})
  }, [])

  // Restore user's saved accent color preference
  useEffect(() => {
    restoreAccent()
  }, [])

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail - SW is optional
      })
    }
  }, [])

  return (
    <>
      <FloatingAgentButton onClick={() => setIsAgentChatOpen(true)} />
      <AgentChatWindow isOpen={isAgentChatOpen} onClose={() => setIsAgentChatOpen(false)} />
    </>
  )
}
