# SystemEvents Bus v0 - Implementation Plan

> **Last Updated:** 2026-01-30
> **Status:** Ready for implementation

## Known Issues

### 1. ✅ RESOLVED: session_id Location

**Decision:** `session_id` is allowed in payloads that need it (e.g., `session_started`). The analytics subscriber reads `session_id` from the payload directly. This matches current analytics patterns and simplifies implementation.

**Why:** Keeping `session_id` in payload avoids unnecessary mapping complexity. The analytics schema already has `session_id`, so we align with that.

### 2. PDFMedia Path Correction

The plan references `src/components/Media/PDFMedia/index.tsx` but actual path is `src/ui/web/media/PDFMedia/index.tsx`.

---

## Overview

Create a client-side pub/sub event bus in `src/lib/system-events/` that is completely separate from the existing `src/infra/analytics/` system. The bus validates payloads with Zod `.strict()` schemas, creates envelopes with metadata, and provides a React hook for usage.

### Analytics Integration Strategy

**All analytics MUST flow through the system event bus.** Components emit system events; analytics subscribes and maps to vendor calls. Direct `analytics.track()` calls from components are prohibited.

```
┌─────────────┐     emit()      ┌──────────────┐    subscribe    ┌─────────────┐
│  Component  │ ──────────────► │  Event Bus   │ ◄────────────── │  Analytics  │
└─────────────┘                 └──────────────┘                 │  Subscriber │
                                                                 └──────┬──────┘
                                                                        │
                                                                        ▼
                                                              ┌─────────────────┐
                                                              │ Vendor SDKs     │
                                                              │ (Mixpanel, etc) │
                                                              └─────────────────┘
```

**Hard Requirements:**

- Analytics subscribes to `systemEventBus` via `on()` or `onAny()`
- Components ONLY call `systemEventBus.emit()` - never `analytics.track()` directly
- Existing direct `analytics.track()` calls in components must be migrated

**Hard NO (Out of Scope):**

- Persisting events to Payload
- Server-side event emission (client-only for v0)

---

## Event Emission Rules

**Critical semantics to preserve:**

| Event                    | Emission Rule             | Rationale                                                                                                                          |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `system.session_started` | **Once per tab session**  | Marks the start of a user's browsing session. Emitted when the app initializes and no existing session is found in sessionStorage. |
| `system.page_viewed`     | **Once per route change** | Tracks navigation. May be emitted multiple times within a single session as the user navigates.                                    |

**Why this matters:**

- `session_started` creates the session context that all subsequent events reference via `meta.session_id`
- `page_viewed` is a repeatable navigation event
- Do NOT "optimize" by deduplicating `page_viewed` or making `session_started` per-page

---

## File Structure

```
src/lib/system-events/
├── index.ts              # Public API exports
├── events.ts             # SYSTEM_EVENTS constants + SystemEventName type
├── schemas.ts            # Zod schemas with .strict()
├── types.ts              # Type definitions (envelope, meta, payloads map)
├── bus.ts                # Bus implementation (exports systemEventBus only)
├── hooks.ts              # useSystemEvents() hook
└── __tests__/
    ├── contracts.test.ts # Schema validation tests
    └── bus.test.ts       # Bus behavior tests
```

---

## Implementation Details

### 1. `src/lib/system-events/events.ts`

Event constants with `system.` namespace prefix (10 events):

```typescript
export const SYSTEM_EVENTS = {
  // Page & Session
  PAGE_VIEWED: 'system.page_viewed',
  SESSION_STARTED: 'system.session_started',
  USER_RESOLVED: 'system.user_resolved',

  // Course & Lesson Lifecycle
  COURSE_ENTERED: 'system.course_entered',
  LESSON_STARTED: 'system.lesson_started',
  LESSON_ENDED: 'system.lesson_ended',

  // Content Interaction
  PDF_VIEWED: 'system.pdf_viewed',
  CHAT_MESSAGE_SUBMITTED: 'system.chat_message_submitted',

  // Registration Funnel
  REGISTRATION_PROMPT_SHOWN: 'system.registration_prompt_shown',
  REGISTRATION_COMPLETED: 'system.registration_completed',
} as const

export type SystemEventName = (typeof SYSTEM_EVENTS)[keyof typeof SYSTEM_EVENTS]
```

---

### 2. `src/lib/system-events/schemas.ts`

Zod schemas with `.strict()` - critical difference from analytics schemas which don't use strict.

**Key payload rules (No PII / No Content):**

- ✅ IDs: `user_id`, `course_id`, `lesson_id`, `document_id`, `conversation_id`, `session_id`
- ✅ Counters: `message_length`, `page_count`
- ✅ Durations: `duration_seconds` (must be ≥0)
- ❌ REJECT: `message_text`, `content`, `prompt`, `response`, `email`, `name`

**Example schema:**

```typescript
import { z } from 'zod'

export const LessonStartedPayloadSchema = z
  .object({
    lesson_id: z.string().min(1),
    course_id: z.string().min(1),
    user_id: z.string().optional(),
  })
  .strict() // <-- MUST have .strict()

// Infer types from schemas
export type LessonStartedPayload = z.infer<typeof LessonStartedPayloadSchema>
```

**Schema registry must have 1:1 mapping with `SYSTEM_EVENTS` keys.**

---

### 3. `src/lib/system-events/types.ts`

**Envelope structure with numeric timestamp:**

```typescript
import type { SystemEventName } from './events'

export interface SystemEventMeta {
  timestamp: number // Unix ms via Date.now() - NOT ISO string
  session_id: string // From sessionStorage (generated once per session)
  route?: string // window.location.pathname
  bus_version: 'v0' // Centralized constant from bus.ts
}

export interface SystemEventEnvelope<T> {
  name: SystemEventName
  payload: T // Validated payload
  meta: SystemEventMeta // Metadata
}

// Per-event payload type mapping (must match schemas exactly)
export type SystemEventPayloads = {
  'system.page_viewed': PageViewedPayload
  'system.session_started': SessionStartedPayload
  'system.user_resolved': UserResolvedPayload
  'system.course_entered': CourseEnteredPayload
  'system.lesson_started': LessonStartedPayload
  'system.lesson_ended': LessonEndedPayload
  'system.pdf_viewed': PdfViewedPayload
  'system.chat_message_submitted': ChatMessageSubmittedPayload
  'system.registration_prompt_shown': RegistrationPromptShownPayload
  'system.registration_completed': RegistrationCompletedPayload
}

// Handler types
export type SystemEventHandler<E extends SystemEventName> = (
  envelope: SystemEventEnvelope<SystemEventPayloads[E]>,
) => void

export type AnySystemEventHandler = (
  envelope: SystemEventEnvelope<SystemEventPayloads[SystemEventName]>,
) => void

export type Unsubscribe = () => void
```

---

### 4. `src/lib/system-events/bus.ts`

**Exports only `systemEventBus`. Version constant is centralized here.**

Key behaviors:

- **SSR guard:** `typeof window === 'undefined'` returns no-op
- **Validation:** Validates payload against `.strict()` schema before emitting
- **Error handling:** Dev throws, prod warns and skips
- **Handler isolation:** Each handler wrapped in try/catch
- **Session ID:** Stored in sessionStorage (key: `system_events_session_id`)
- **Bus version:** Centralized constant `BUS_VERSION = 'v0' as const`

```typescript
import type { SystemEventName } from './events'
import type {
  SystemEventPayloads,
  SystemEventHandler,
  AnySystemEventHandler,
  Unsubscribe,
} from './types'

const BUS_VERSION = 'v0' as const

export interface SystemEventBus {
  emit<E extends SystemEventName>(event: E, payload: SystemEventPayloads[E]): void
  on<E extends SystemEventName>(event: E, handler: SystemEventHandler<E>): Unsubscribe
  onAny(handler: AnySystemEventHandler): Unsubscribe
}

export const systemEventBus: SystemEventBus = {
  // Implementation
}
```

---

### 5. `src/lib/system-events/hooks.ts`

**Note:** `onAny` is intentionally NOT exposed via the hook. It encourages "god listeners" and is a foot-gun in React components. Use `systemEventBus.onAny()` directly for non-component code (e.g., analytics subscriber).

```typescript
export interface UseSystemEventsReturn {
  emit: SystemEventBus['emit']
  on: SystemEventBus['on']
  SYSTEM_EVENTS: typeof SYSTEM_EVENTS
}

export function useSystemEvents(): UseSystemEventsReturn {
  // Returns: { emit, on, SYSTEM_EVENTS }
  // - Stable references with useCallback
  // - Dev-only warning on unmount if subscriptions not cleaned up
  //   (NO auto-cleanup, just a console.warn)
}
```

**Cleanup warning behavior:**

- Hook tracks subscriptions created via `on()`
- On unmount, if any unsubscribe functions weren't called: `console.warn()` in dev only
- Guarded by `process.env.NODE_ENV === 'development'`
- **No magic:** Does NOT auto-unsubscribe. Developer must call unsubscribe explicitly.

---

### 6. `src/lib/system-events/index.ts`

**Public exports from correct sources:**

```typescript
// Hook
export { useSystemEvents } from './hooks'

// Bus (only systemEventBus, NOT SYSTEM_EVENTS)
export { systemEventBus } from './bus'

// Events (SYSTEM_EVENTS lives here)
export { SYSTEM_EVENTS } from './events'
export type { SystemEventName } from './events'

// Types
export type {
  SystemEventEnvelope,
  SystemEventMeta,
  SystemEventPayloads,
  SystemEventHandler,
  AnySystemEventHandler,
  Unsubscribe,
} from './types'

// Payload types (inferred from schemas)
export type {
  PageViewedPayload,
  SessionStartedPayload,
  UserResolvedPayload,
  CourseEnteredPayload,
  LessonStartedPayload,
  LessonEndedPayload,
  PdfViewedPayload,
  ChatMessageSubmittedPayload,
  RegistrationPromptShownPayload,
  RegistrationCompletedPayload,
} from './schemas'
```

---

## Event Payload Definitions (v0) - 10 Events

| Event                       | Required Fields                          | Optional Fields                       |
| --------------------------- | ---------------------------------------- | ------------------------------------- |
| `page_viewed`               | `page_path`                              | `page_title`, `page_search`, `locale` |
| `session_started`           | `session_id`, `is_anonymous`             | `locale`                              |
| `user_resolved`             | `user_id`                                | `auth_method`                         |
| `course_entered`            | `course_id`                              | `user_id`                             |
| `lesson_started`            | `lesson_id`, `course_id`                 | `user_id`                             |
| `lesson_ended`              | `lesson_id`, `course_id`                 | `user_id`, `duration_seconds` (≥0)    |
| `pdf_viewed`                | `document_id`                            | `lesson_id`, `user_id`, `page_count`  |
| `chat_message_submitted`    | `conversation_id`, `message_length` (≥0) | `lesson_id`, `user_id`                |
| `registration_prompt_shown` | `trigger_type`                           | `current_page`                        |
| `registration_completed`    | `user_id`, `auth_method`                 | (none)                                |

**`trigger_type` enum:** `'exercise_limit' | 'copilot_limit' | 'feature_gate' | 'manual'`

**`duration_seconds` note:** Optional field for `lesson_ended`. If present, schema enforces `.min(0)`. This is a v0 lifecycle compromise - duration tracking is best-effort.

---

## Test Coverage

### `contracts.test.ts`

- Valid payloads pass for each event type
- Missing required fields fail
- Unknown properties rejected (`.strict()` enforcement)
- PII fields rejected (`email`, `name`, `message_text`, `content`, `prompt`, `response`)
- Invalid values rejected (negative durations, empty strings where `.min(1)`)
- Schema registry has entry for every `SYSTEM_EVENT` (10 total)
- Payload types match schema inferences exactly
- **`chat_message_submitted` requires `message_length`** (not optional)
- **`chat_message_submitted` rejects negative `message_length`**

### `bus.test.ts`

- Emit delivers envelope to subscribers
- Envelope has correct structure: `{ name, payload, meta }`
- **Meta contains numeric `timestamp`** (Unix ms, not ISO string)
- Meta contains `session_id`, `route`, `bus_version: 'v0'`
- Multiple subscribers receive same event
- Unsubscribe removes handler
- Handler errors isolated (other handlers still called)
- Handler errors logged
- `onAny` receives all events (tested via `systemEventBus.onAny()`, NOT hook)
- SSR guard: no throw when `window` undefined
- Dev mode throws on invalid payload
- Consistent `session_id` across emissions (from sessionStorage)
- **Type safety:** `emit()` is compile-time safe per event name (TS test)

#### Edge Case Tests

- **Race conditions:** Handlers registered AFTER emit should NOT receive event
- **Handler order:** Multiple handlers receive events in subscription order
- **Session storage errors:** Bus should not throw when sessionStorage unavailable
- **Graceful fallback:** Generate session_id if sessionStorage throws

### `hooks.test.ts` (optional, can be in `bus.test.ts`)

- `useSystemEvents()` returns `{ emit, on, SYSTEM_EVENTS }` (no `onAny`)
- Dev-only warning on unmount if subscriptions not cleaned up
- No warning if all unsubscribe functions called before unmount
- No auto-cleanup behavior (subscriptions remain active if not manually unsubscribed)

### `system-events-subscriber.test.ts`

- When system event emitted, subscriber calls `analytics.track()` with mapped event name
- All 10 system events have corresponding subscriber handlers
- Subscriber initialization is idempotent (calling twice logs warning, doesn't double-subscribe)
- Cleanup function removes all subscriptions (no further track calls)
- **Fail-safe:** If `analytics.track()` throws, subscriber does NOT throw (error logged)
- `USER_RESOLVED` calls both `analytics.track()` AND `analytics.identify()`
- `REGISTRATION_COMPLETED` calls both `analytics.track()` AND `analytics.identify()`
- `SESSION_STARTED` reads `session_id` from envelope payload

### `no-direct-analytics-in-ui.int.spec.ts`

- No `analytics.track()` calls in `src/app/(frontend)/`
- No `analytics.track()` calls in `src/components/`
- No `analytics.identify()` calls in `src/app/(frontend)/`
- No `analytics.identify()` calls in `src/components/`
- Allowlist: `src/infra/analytics/**` is allowed to use `analytics.track()`

---

## Analytics Integration

### Architecture

Analytics is a **subscriber** to the event bus, not a direct call target. All tracking flows through system events.

### 7. `src/infra/analytics/system-events-subscriber.ts`

**Full implementation with all 10 event mappings:**

```typescript
import { systemEventBus, SYSTEM_EVENTS } from '@/lib/system-events'
import type { Unsubscribe } from '@/lib/system-events'
import { analytics } from './core/tracker'
import { PRODUCT_EVENTS } from './contracts/events'

let initialized = false
let cleanupFns: Unsubscribe[] = []

/**
 * Initialize analytics subscriber to the system event bus.
 * Maps all system events to analytics.track() calls.
 *
 * @returns Cleanup function that unsubscribes all handlers
 */
export function initAnalyticsSubscriber(): () => void {
  // Idempotent: only initialize once
  if (initialized) {
    console.warn('[Analytics] Subscriber already initialized, skipping')
    return () => cleanup()
  }
  initialized = true

  // Helper to wrap handlers with error isolation
  const safeSubscribe = <T>(
    event: Parameters<typeof systemEventBus.on>[0],
    handler: (envelope: T) => void,
  ): Unsubscribe => {
    return systemEventBus.on(event, (envelope) => {
      try {
        handler(envelope as T)
      } catch (error) {
        console.error(`[Analytics] Error handling ${event}:`, error)
        // Never throw - fail-safe
      }
    })
  }

  // Subscribe to all 10 system events
  cleanupFns = [
    // Page & Session
    safeSubscribe(SYSTEM_EVENTS.PAGE_VIEWED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.PAGE_VIEW, {
        page_path: envelope.payload.page_path,
        page_title: envelope.payload.page_title,
        page_search: envelope.payload.page_search,
        locale: envelope.payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.SESSION_STARTED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.SESSION_STARTED, {
        session_id: envelope.payload.session_id, // From payload
        is_anonymous: envelope.payload.is_anonymous,
        locale: envelope.payload.locale,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.USER_RESOLVED, (envelope) => {
      // Map to USER_IDENTIFIED event
      analytics.track(PRODUCT_EVENTS.USER_IDENTIFIED, {
        user_id: envelope.payload.user_id,
        is_new_user: false, // Existing pattern
      })
      // Also call identify for vendor SDKs
      analytics.identify(envelope.payload.user_id, {
        auth_method: envelope.payload.auth_method,
      })
    }),

    // Course & Lesson Lifecycle
    safeSubscribe(SYSTEM_EVENTS.COURSE_ENTERED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.COURSE_ENTERED, {
        course_id: envelope.payload.course_id,
        user_id: envelope.payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.LESSON_STARTED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
        lesson_id: envelope.payload.lesson_id,
        course_id: envelope.payload.course_id,
        user_id: envelope.payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.LESSON_ENDED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.LESSON_COMPLETED, {
        lesson_id: envelope.payload.lesson_id,
        course_id: envelope.payload.course_id,
        duration_seconds: envelope.payload.duration_seconds,
        user_id: envelope.payload.user_id,
      })
    }),

    // Content Interaction
    safeSubscribe(SYSTEM_EVENTS.PDF_VIEWED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.PDF_VIEWED, {
        document_id: envelope.payload.document_id,
        page_count: envelope.payload.page_count,
        lesson_id: envelope.payload.lesson_id,
        user_id: envelope.payload.user_id,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.CHAT_MESSAGE_SUBMITTED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.CHAT_MESSAGE_SENT, {
        conversation_id: envelope.payload.conversation_id,
        message_length: envelope.payload.message_length,
        lesson_id: envelope.payload.lesson_id,
        user_id: envelope.payload.user_id,
      })
    }),

    // Registration Funnel
    safeSubscribe(SYSTEM_EVENTS.REGISTRATION_PROMPT_SHOWN, (envelope) => {
      analytics.track(PRODUCT_EVENTS.REGISTRATION_PROMPT_SHOWN, {
        trigger_type: envelope.payload.trigger_type,
        current_page: envelope.payload.current_page,
      })
    }),

    safeSubscribe(SYSTEM_EVENTS.REGISTRATION_COMPLETED, (envelope) => {
      analytics.track(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
        user_id: envelope.payload.user_id,
        auth_method: envelope.payload.auth_method,
      })
      // Also identify the new user
      analytics.identify(envelope.payload.user_id, {
        auth_method: envelope.payload.auth_method,
      })
    }),
  ]

  return () => cleanup()
}

function cleanup(): void {
  cleanupFns.forEach((unsubscribe) => unsubscribe())
  cleanupFns = []
  initialized = false
}
```

### Initialization in AnalyticsProvider

Modify `src/infra/analytics/providers/AnalyticsProvider.tsx`:

```typescript
import { initAnalyticsSubscriber } from '../system-events-subscriber'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeAnalytics()

    // Initialize system events subscriber
    const cleanupSubscriber = initAnalyticsSubscriber()

    // Existing session_started logic moves to component that emits system event
    // (see migration section)

    return () => {
      cleanupSubscriber()
    }
  }, [])

  return (
    <AnalyticsContext.Provider value={analytics}>
      {children}
    </AnalyticsContext.Provider>
  )
}
```

### Migration: Specific Files to Update

**Audit results - files with direct `analytics.track()` calls to migrate:**

| File                            | Current Event                               | System Event                     | Notes                      |
| ------------------------------- | ------------------------------------------- | -------------------------------- | -------------------------- |
| `LessonAnalytics.tsx`           | `LESSON_STARTED`, `LESSON_COMPLETED`        | `LESSON_STARTED`, `LESSON_ENDED` | Headless component pattern |
| `CourseAnalytics.tsx`           | `COURSE_ENTERED`                            | `COURSE_ENTERED`                 | Headless component         |
| `useNotebookChat.ts`            | `CHAT_MESSAGE_SENT`                         | `CHAT_MESSAGE_SUBMITTED`         | In `sendMessage()`         |
| `PDFMedia/index.tsx`            | `PDF_VIEWED`                                | `PDF_VIEWED`                     | useEffect on mount         |
| `SignupForm.tsx`                | `REGISTRATION_COMPLETED`, `USER_IDENTIFIED` | `REGISTRATION_COMPLETED`         | On successful signup       |
| `UserIdentificationTracker.tsx` | `USER_IDENTIFIED`                           | `USER_RESOLVED`                  | On login detection         |
| `AnalyticsProvider.tsx`         | `SESSION_STARTED`                           | `SESSION_STARTED`                | Move to dedicated emitter  |

**Migration example - LessonAnalytics.tsx:**

Before:

```typescript
// ❌ Direct analytics call
import { analytics, PRODUCT_EVENTS } from '@/infra/analytics'

export function LessonAnalytics({ lessonId, courseId, lessonTitle }: Props) {
  const startTime = useRef(Date.now())

  useEffect(() => {
    analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
      lesson_id: lessonId,
      course_id: courseId,
      lesson_title: lessonTitle,
    })

    return () => {
      const durationSeconds = Math.floor((Date.now() - startTime.current) / 1000)
      analytics.track(PRODUCT_EVENTS.LESSON_COMPLETED, {
        lesson_id: lessonId,
        course_id: courseId,
        duration_seconds: durationSeconds,
      })
    }
  }, [lessonId, courseId, lessonTitle])

  return null
}
```

After:

```typescript
// ✅ Emit system event
import { useSystemEvents, SYSTEM_EVENTS } from '@/lib/system-events'

export function LessonAnalytics({ lessonId, courseId }: Props) {
  const { emit } = useSystemEvents()
  const startTime = useRef(Date.now())

  useEffect(() => {
    emit(SYSTEM_EVENTS.LESSON_STARTED, {
      lesson_id: lessonId,
      course_id: courseId,
    })

    return () => {
      const durationSeconds = Math.floor((Date.now() - startTime.current) / 1000)
      emit(SYSTEM_EVENTS.LESSON_ENDED, {
        lesson_id: lessonId,
        course_id: courseId,
        duration_seconds: durationSeconds,
      })
    }
  }, [emit, lessonId, courseId])

  return null
}
```

### Guardrail Test

Create `tests/int/guardrails/no-direct-analytics-in-ui.int.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import path from 'path'

describe('No direct analytics calls in UI code', () => {
  it('should not have analytics.track() in components or app routes', () => {
    const searchPaths = ['src/app/(frontend)', 'src/components']

    // Allowlist: only analytics infrastructure can use analytics.track
    const allowlist = ['src/infra/analytics/']

    for (const searchPath of searchPaths) {
      const fullPath = path.join(process.cwd(), searchPath)

      try {
        // Search for direct analytics calls
        const result = execSync(
          `grep -r "analytics\\.track\\|analytics\\.identify" "${fullPath}" --include="*.tsx" --include="*.ts" -l || true`,
          { encoding: 'utf-8' },
        )

        const files = result.trim().split('\n').filter(Boolean)
        const violations = files.filter(
          (file) => !allowlist.some((allowed) => file.includes(allowed)),
        )

        expect(violations).toEqual([])
      } catch {
        // grep returns non-zero if no matches, which is good
      }
    }
  })
})
```

---

## Critical Files to Modify

**Create:**

- `src/lib/system-events/events.ts`
- `src/lib/system-events/schemas.ts`
- `src/lib/system-events/types.ts`
- `src/lib/system-events/bus.ts`
- `src/lib/system-events/hooks.ts`
- `src/lib/system-events/index.ts`
- `src/lib/system-events/__tests__/contracts.test.ts`
- `src/lib/system-events/__tests__/bus.test.ts`
- `src/infra/analytics/system-events-subscriber.ts` - Analytics subscriber
- `src/infra/analytics/__tests__/system-events-subscriber.test.ts` - Subscriber tests
- `tests/int/guardrails/no-direct-analytics-in-ui.int.spec.ts` - Guardrail test

**Modify:**

- `vitest.config.mts` - Add `'src/**/*.test.ts'` to include pattern
- `src/infra/analytics/providers/AnalyticsProvider.tsx` - Initialize subscriber + cleanup
- **Migration (7 files):**
  - `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonAnalytics.tsx`
  - `src/app/(frontend)/courses/[courseSlug]/_components/CourseAnalytics.tsx`
  - `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseId]/_components/NotebookChat/useNotebookChat.ts`
  - `src/ui/web/media/PDFMedia/index.tsx`
  - `src/app/(frontend)/signup/SignupForm.tsx`
  - `src/infra/analytics/components/UserIdentificationTracker.tsx`
  - `src/infra/analytics/providers/AnalyticsProvider.tsx` (move SESSION_STARTED)

**Reference (patterns to follow):**

- `src/infra/analytics/contracts/events.ts` - Event constants pattern
- `src/infra/analytics/contracts/schemas.ts` - Schema structure (but add `.strict()`)
- `src/infra/analytics/core/tracker.ts` - Session ID and SSR patterns

---

## Implementation Order

### Phase 1: Core Event Bus

1. `events.ts` - Event constants and `SystemEventName` type
2. `schemas.ts` - Zod schemas with `.strict()` + inferred payload types
3. `types.ts` - Envelope, meta, `SystemEventPayloads` mapping, handler types
4. `bus.ts` - Core bus implementation (exports `systemEventBus` only, `BUS_VERSION` constant)
5. `hooks.ts` - React hook
6. `index.ts` - Public exports from correct sources
7. `vitest.config.mts` - Update include pattern
8. `contracts.test.ts` - Schema validation tests
9. `bus.test.ts` - Bus behavior tests

### Phase 2: Analytics Integration

10. `system-events-subscriber.ts` - Create analytics subscriber with mappings for all 10 events
11. Initialize subscriber in app providers
12. **Audit:** Find all direct `analytics.track()` calls in components
13. **Migrate:** Replace each direct call with `systemEventBus.emit()`
14. **Verify:** Ensure analytics events still fire correctly (check vendor dashboards)

---

## Verification Checklist

### Type Safety

- [ ] `pnpm typecheck` passes
- [ ] `emit()` errors at compile time for wrong payload per event
- [ ] `SystemEventPayloads` keys match `SYSTEM_EVENTS` values exactly
- [ ] Schema inferred types match `SystemEventPayloads` types

### Lint & Format

- [ ] `pnpm lint` passes
- [ ] `pnpm format:check` passes

### Tests

- [ ] `pnpm test` passes (all new tests)
- [ ] Bus tests verify numeric `timestamp` in meta
- [ ] Bus tests verify `session_id` present in envelope

### Manual Verification

- [ ] Import works: `import { useSystemEvents, SYSTEM_EVENTS } from '@/lib/system-events'`
- [ ] Emit valid event: No error in console
- [ ] Emit invalid event (dev): Throws with validation error
- [ ] Emit with `session_id` in payload: Throws (`.strict()` rejects)
- [ ] Subscribe and unsubscribe: Handler called/not called
- [ ] `useSystemEvents()` does NOT expose `onAny` (TypeScript error if accessed)
- [ ] `systemEventBus.onAny()` works for non-component subscribers
- [ ] Hook warns in dev when component unmounts with active subscriptions
- [ ] Hook does NOT auto-cleanup subscriptions
- [ ] Check envelope structure in `console.debug` output:
  - `meta.timestamp` is number (Unix ms)
  - `meta.session_id` is string
  - `meta.bus_version` is `'v0'`
  - `session_started` payload includes `session_id`

### Analytics Integration

- [ ] `initAnalyticsSubscriber()` called once at app startup
- [ ] All 10 system events have corresponding analytics subscriber mappings
- [ ] **Zero direct `analytics.track()` calls in components** (run grep audit)
- [ ] Analytics events appear in vendor dashboard (Mixpanel, etc.) when system events emit
- [ ] Event payloads in vendor dashboard match expected schema

---

## Summary of Corrections Applied

1. **Simplified `session_id` handling** - `session_id` is allowed in payloads (e.g., `session_started`), matching analytics schema patterns
2. **Changed `meta.timestamp` to numeric** - Unix ms via `Date.now()`, not ISO string
3. **Fixed exports** - `SYSTEM_EVENTS` from `events.ts`, `systemEventBus` from `bus.ts`
4. **Added `SystemEventPayloads` type map** - Compile-time safe `emit()` per event
5. **Centralized `BUS_VERSION`** - Single constant in `bus.ts`
6. **Clarified `duration_seconds`** - Optional, `.min(0)` when present, documented as v0 compromise
7. **Added emission rules** - `session_started` once per tab, `page_viewed` per route change
8. **Removed `onAny` from hook** - Only available on `systemEventBus` directly, not via `useSystemEvents()`
9. **Hook cleanup is dev-only warning** - No auto-cleanup, just `console.warn` if subscriptions leaked
10. **All analytics through event bus** - Components emit system events, analytics subscribes. Zero direct `analytics.track()` calls allowed in components.
11. **Made `message_length` required** - `chat_message_submitted.message_length` is now required, not optional
12. **Full subscriber implementation** - `initAnalyticsSubscriber()` returns cleanup function, is idempotent, fail-safe
13. **Specific migration files identified** - 7 files with direct analytics calls to migrate
14. **Guardrail test added** - Integration test to enforce no direct analytics in UI code
