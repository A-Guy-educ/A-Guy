/**
 * GA4 Event Transformation
 *
 * Transforms canonical events to GA4 format
 * Maps event names and properties to GA4 conventions
 */

import { PRODUCT_EVENTS } from '../../contracts/events'
import type { EventPayload } from '../../types'

/**
 * GA4 event structure
 */
export interface GA4Event {
  name: string
  params: Record<string, unknown>
}

/**
 * Map canonical events to GA4 event names
 *
 * GA4 has recommended event names for common actions
 * https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */
const GA4_EVENT_MAPPING: Partial<Record<string, string>> = {
  [PRODUCT_EVENTS.PAGE_VIEW]: 'page_view',
  [PRODUCT_EVENTS.SESSION_STARTED]: 'session_start',
  [PRODUCT_EVENTS.SESSION_ENDED]: 'session_end',
  [PRODUCT_EVENTS.REGISTRATION_COMPLETED]: 'sign_up',
  // Other events use canonical names as-is
}

/**
 * Transform canonical event payload to GA4 format
 *
 * @param payload - Canonical event payload
 * @returns GA4-formatted event
 */
export function transformToGA4(payload: EventPayload): GA4Event {
  const { event, properties, timestamp, sessionId } = payload

  // Get GA4 event name (use mapping or canonical name)
  const ga4EventName = GA4_EVENT_MAPPING[event] || event

  // Add metadata
  const params: Record<string, unknown> = {
    ...properties,
    event_timestamp: timestamp,
    session_id: sessionId,
  }

  // Add page location for page_view events
  if (event === PRODUCT_EVENTS.PAGE_VIEW && typeof window !== 'undefined') {
    params.page_location = window.location.href
    params.page_referrer = document.referrer || undefined
  }

  return {
    name: ga4EventName,
    params,
  }
}
