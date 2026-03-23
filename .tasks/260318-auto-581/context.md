# Codebase Context: 260318-auto-581

## Files to Modify

### Core Analytics Infrastructure (7 files)

- `src/infra/system-events/events.ts` (lines 11-64) — Add 9 new SYSTEM_EVENTS constants
- `src/infra/system-events/schemas.ts` (after line 209) — Add 9 new Zod schemas with `.strict()` mode
- `src/infra/analytics/contracts/events.ts` (after line 52) — Add 9 new PRODUCT_EVENTS constants
- `src/infra/analytics/contracts/schemas.ts` (after line 310) — Add 9 new analytics property schemas
- `src/infra/analytics/contracts/destinations.ts` (after line 58) — Add 9 new destination routing entries
- `src/infra/analytics/system-events-subscriber.ts` (after line 379) — Add 9 new safeSubscribe handlers
- `src/infra/analytics/hooks/usePageAbandonment.ts` (lines 19-77) — Add time_on_page threshold tracking

### Test Files to Create (1 file)

- `tests/unit/analytics/new-events.test.ts` (NEW) — Test new event constants, schemas, and subscriber handlers

## Files to Read (Reference Patterns)

- `src/infra/system-events/events.ts` — Pattern: `SYSTEM_EVENTS = { KEY: 'system.key' }`
- `src/infra/system-events/schemas.ts` — Pattern: `export const XxxSchema = z.object({...}).strict()`
- `src/infra/analytics/contracts/events.ts` — Pattern: `PRODUCT_EVENTS = { KEY: 'key' }`
- `src/infra/analytics/contracts/schemas.ts` — Pattern: Zod schemas with `.describe()` calls
- `src/infra/analytics/contracts/destinations.ts` — Pattern: `eventDestinations: Record<ProductEvent, AnalyticsDestination[]>`
- `src/infra/analytics/system-events-subscriber.ts` — Pattern: `safeSubscribe(SYSTEM_EVENTS.X, handler)`
- `src/infra/analytics/hooks/usePageAbandonment.ts` — Pattern: React hook with `useEffect` for tracking

## Key Signatures

### System Events
```typescript
// From src/infra/system-events/events.ts
export const SYSTEM_EVENTS = {
  LESSON_STARTED: 'system.lesson_started',
  // ...
} as const
export type SystemEventName = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS]
```

### Product Events
```typescript
// From src/infra/analytics/contracts/events.ts
export const PRODUCT_EVENTS = {
  LESSON_STARTED: 'lesson_started',
  // ...
} as const
export type ProductEvent = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS]
```

### Analytics Track
```typescript
// From src/infra/analytics/core/tracker.ts
export function track(event: ProductEvent, properties?: Record<string, unknown>): void
```

### Safe Subscribe Pattern
```typescript
// From src/infra/analytics/system-events-subscriber.ts
const safeSubscribe = (
  event: SystemEventName,
  handler: (envelope: SystemEventEnvelope<unknown>) => void,
): Unsubscribe => {
  return systemEventBus.on(event, (envelope) => {
    try {
      handler(envelope)
    } catch (error) {
      console.error(`[Analytics] Error handling ${event}:`, error)
    }
  })
}
```

### Schema Registry
```typescript
// From src/infra/analytics/contracts/schemas.ts
export const eventSchemas = {
  [PRODUCT_EVENTS.PAGE_VIEW]: PageViewSchema,
  // ...
} as const
```

### Destination Routing
```typescript
// From src/infra/analytics/contracts/destinations.ts
export const eventDestinations: Record<ProductEvent, AnalyticsDestination[]> = {
  [PRODUCT_EVENTS.PAGE_VIEW]: ['ga4', 'mixpanel'],
  // ...
}

export function shouldSendToMixpanel(event: ProductEvent): boolean {
  return eventDestinations[event].includes('mixpanel')
}
```

## Reuse Inventory

- **`safeSubscribe()`** from `system-events-subscriber.ts` — Reuse for all new handlers
- **`.strict()` schema pattern** — All new schemas must use this
- **`eventSchemas` registry pattern** — Add new entries to both system and analytics registries
- **`eventDestinations` record pattern** — Add routing for all 9 events to `['mixpanel']`
- **Existing `usePageAbandonment.ts` hook pattern** — Extend with interval-based threshold tracking

## Integration Points

- New events must be registered in 4 places: events.ts (constants), schemas.ts (both), destinations.ts, subscriber
- `systemEventBus.emit()` is called by components to fire events
- Analytics subscriber listens and calls `analytics.track()` for each event
- `usePageAbandonment.ts` hook is used in client components to track engagement

## Imports Verified

- `@/infra/system-events` → exports `SYSTEM_EVENTS`, `systemEventBus` ✅
- `@/infra/analytics/contracts/events` → exports `PRODUCT_EVENTS` ✅
- `@/infra/analytics/contracts/schemas` → exports all schemas ✅
- `@/infra/analytics/contracts/destinations` → exports `eventDestinations`, `shouldSendToMixpanel` ✅
- `@/infra/analytics/system-events-subscriber` → exports `initAnalyticsSubscriber` ✅
- `@/infra/analytics/core/tracker` → exports `analytics` ✅
- `@/infra/analytics` → exports `analytics`, `PRODUCT_EVENTS` ✅

## Test Pattern

```typescript
// tests/unit/analytics/new-events.test.ts
import { describe, it, expect } from 'vitest'
import { SYSTEM_EVENTS } from '@/infra/system-events'
import { PRODUCT_EVENTS } from '@/infra/analytics/contracts/events'

describe('New Analytics Events', () => {
  it('should have all 9 system event constants', () => {
    expect(SYSTEM_EVENTS.ANSWER_CORRECT).toBe('system.answer_correct')
    // ...
  })
  
  it('should have all 9 product event constants', () => {
    expect(PRODUCT_EVENTS.ANSWER_CORRECT).toBe('answer_correct')
    // ...
  })
})
```
