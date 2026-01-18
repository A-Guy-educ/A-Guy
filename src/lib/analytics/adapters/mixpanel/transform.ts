/**
 * Mixpanel Event Transformation
 *
 * Transforms canonical events to Mixpanel format
 * Mixpanel uses canonical names as-is (no name mapping needed)
 */

import type { EventPayload } from '../../types'

/**
 * Mixpanel event structure
 */
export interface MixpanelEvent {
  name: string
  properties: Record<string, unknown>
}

/**
 * Transform canonical event payload to Mixpanel format
 *
 * @param payload - Canonical event payload
 * @returns Mixpanel-formatted event
 */
export function transformToMixpanel(payload: EventPayload): MixpanelEvent {
  const { event, properties, timestamp, sessionId } = payload

  // Mixpanel uses canonical event names directly
  const mixpanelEventName = event

  // Add metadata
  const mixpanelProperties: Record<string, unknown> = {
    ...properties,
    event_timestamp: timestamp,
    session_id: sessionId,
  }

  // Add page context if available
  if (typeof window !== 'undefined') {
    mixpanelProperties.$current_url = window.location.href
    mixpanelProperties.$referrer = document.referrer || undefined
  }

  return {
    name: mixpanelEventName,
    properties: mixpanelProperties,
  }
}
