# Analytics System

Canonical event tracking system for A-Guy platform.

## Implementation Status

**✅ Fully Integrated (8 events):**

- `page_view` - Auto-tracked via LayoutClient
- `session_started` - Auto-tracked via AnalyticsProvider
- `user_identified` - Auto-tracked via UserIdentificationTracker + SignupForm
- `course_entered` - Integrated in course page
- `lesson_started` - Integrated in lesson page
- `pdf_viewed` - Integrated in PDFMedia component
- `chat_message_sent` - Integrated in useNotebookChat hook
- `registration_completed` - Integrated in SignupForm

**⚠️ Pending UX Triggers (2 events):**

- `lesson_completed` - Requires UI button/completion flow
- `registration_prompt_shown` - Requires registration modal implementation

## Architecture

```
Product Code → track() → Validation → Routing → Adapters (GA4/Mixpanel)
```

**Design Principles:**

- Events over clicks - only track meaningful behavior
- Canonical before tools - define events first
- Single entrypoint - all tracking through `track()`
- Zero direct SDK calls - no `window.gtag()` or `window.mixpanel`
- Tool separation - GA4 for traffic, Mixpanel for product

## Usage

### Basic Tracking

```tsx
import { analytics, PRODUCT_EVENTS } from '@/lib/analytics'

// Track an event
analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
  lesson_id: '123',
  course_id: '456',
  lesson_title: 'Introduction to Algebra',
})

// Identify a user
analytics.identify('user_id_123', {
  // NO PII - only IDs
})

// Reset on logout
analytics.reset()
```

### Using the Hook

```tsx
'use client'
import { useAnalytics } from '@/lib/analytics/providers/AnalyticsProvider'
import { PRODUCT_EVENTS } from '@/lib/analytics'

function MyComponent() {
  const analytics = useAnalytics()

  const handleAction = () => {
    analytics.track(PRODUCT_EVENTS.COURSE_ENTERED, {
      course_id: '123',
    })
  }

  return <button onClick={handleAction}>Enter Course</button>
}
```

## Current Events (v1)

| Event                       | Destination    | Priority |
| --------------------------- | -------------- | -------- |
| `page_view`                 | GA4 + Mixpanel | P0       |
| `session_started`           | GA4 + Mixpanel | P0       |
| `user_identified`           | Mixpanel       | P0       |
| `course_entered`            | Mixpanel       | P0       |
| `lesson_started`            | Mixpanel       | P0       |
| `lesson_completed`          | Mixpanel       | P0       |
| `pdf_viewed`                | Mixpanel       | P1       |
| `chat_message_sent`         | Mixpanel       | P1       |
| `registration_prompt_shown` | Mixpanel       | P0       |
| `registration_completed`    | GA4 + Mixpanel | P0       |

## How to Add Event #11 (and Beyond)

Adding a new event requires updating 4 files:

### Step 1: Define Event Constant

**File:** `src/lib/analytics/contracts/events.ts`

```typescript
export const PRODUCT_EVENTS = {
  // ... existing events
  EXERCISE_COMPLETED: 'exercise_completed', // NEW
} as const
```

### Step 2: Create Zod Schema

**File:** `src/lib/analytics/contracts/schemas.ts`

```typescript
/**
 * exercise_completed - Track exercise completion
 * Destination: Mixpanel
 * Priority: P0
 *
 * CRITICAL: No PII/content - only IDs and metadata
 */
export const ExerciseCompletedSchema = z.object({
  exercise_id: z.string().describe('Exercise identifier'),
  course_id: z.string().describe('Parent course ID'),
  score: z.number().optional().describe('Exercise score (0-100)'),
  duration_seconds: z.number().optional().describe('Time spent'),
  // NO solution text, NO student answers - privacy violation
})

// Add to eventSchemas mapping
export const eventSchemas = {
  // ... existing schemas
  [PRODUCT_EVENTS.EXERCISE_COMPLETED]: ExerciseCompletedSchema,
} as const

// Export TypeScript type
export type ExerciseCompletedProperties = z.infer<typeof ExerciseCompletedSchema>
```

### Step 3: Configure Destination

**File:** `src/lib/analytics/contracts/destinations.ts`

```typescript
export const eventDestinations: Record<ProductEvent, AnalyticsDestination[]> = {
  // ... existing destinations
  [PRODUCT_EVENTS.EXERCISE_COMPLETED]: ['mixpanel'], // Product analytics only
}
```

### Step 4: Update Public Exports

**File:** `src/lib/analytics/index.ts`

```typescript
export type {
  // ... existing types
  ExerciseCompletedProperties, // NEW
} from './contracts/schemas'
```

### Step 5: Use in Product Code

```tsx
import { analytics, PRODUCT_EVENTS } from '@/lib/analytics'

function ExercisePage() {
  const handleComplete = (score: number, duration: number) => {
    analytics.track(PRODUCT_EVENTS.EXERCISE_COMPLETED, {
      exercise_id: '123',
      course_id: '456',
      score,
      duration_seconds: duration,
    })
  }
}
```

### Step 6: Add Tests

**File:** `tests/int/analytics/analytics-validator.int.spec.ts`

```typescript
it('should validate exercise_completed event', () => {
  const result = validateEvent(PRODUCT_EVENTS.EXERCISE_COMPLETED, {
    exercise_id: '123',
    course_id: '456',
    score: 85,
  })

  expect(result.success).toBe(true)
})
```

## Privacy & Payload Policy

**NEVER send or store:**

- Raw chat text
- PDF/document contents
- Email addresses, phone numbers
- Passwords, tokens, auth headers
- Cookie values
- Student work product (code, answers, essays)

**ONLY send:**

- IDs (lesson_id, course_id, etc.)
- Counters (page_count, message_length)
- Durations (duration_seconds)
- Sanitized metadata (file_name, page_title)

## Environment Configuration

```bash
# Master enable switch
NEXT_PUBLIC_ANALYTICS_ENABLED=false

# Debug mode - log events to console
NEXT_PUBLIC_ANALYTICS_DEBUG=true

# Dry-run mode - log without sending
NEXT_PUBLIC_ANALYTICS_DRY_RUN=true

# GA4
NEXT_PUBLIC_GA4_ENABLED=false
NEXT_PUBLIC_GA4_MEASUREMENT_ID=

# Mixpanel
NEXT_PUBLIC_MIXPANEL_ENABLED=false
NEXT_PUBLIC_MIXPANEL_TOKEN=
```

## Feature Flags Behavior

| Flag                      | Behavior                                    |
| ------------------------- | ------------------------------------------- |
| `ANALYTICS_ENABLED=false` | Nothing tracked, scripts not loaded         |
| `ANALYTICS_DEBUG=true`    | Log all events to console                   |
| `ANALYTICS_DRY_RUN=true`  | Log events but don't send to platforms      |
| `GA4_ENABLED=false`       | GA4 script not loaded, events not sent      |
| `MIXPANEL_ENABLED=false`  | Mixpanel script not loaded, events not sent |

## Validation Behavior

**Development/Staging:**

- Unknown events → Throw error (fail fast)
- Invalid properties → Throw error with details

**Production:**

- Unknown events → Log warning, continue best-effort
- Invalid properties → Log warning, continue best-effort

**Why:** Never break user flows in production, but catch issues early in dev.

## Page View Tracking

**CRITICAL:** Page views are tracked in ONE place only:

- **File:** `src/app/(frontend)/LayoutClient.tsx`
- **Hook:** `usePageView()`
- **Rule:** NEVER call `track(PRODUCT_EVENTS.PAGE_VIEW)` from components

Tracking page views from multiple places causes duplicates.

## Session Tracking

**Session Logic:**

- Uses `sessionStorage` for per-tab sessions
- `session_started` emitted once per session
- Session ID generated on first visit
- Persists across page reloads within same tab

## User Identity Flow

```typescript
// 1. User starts anonymous
analytics.track(PRODUCT_EVENTS.SESSION_STARTED, { is_anonymous: true })

// 2. User signs up
analytics.track(PRODUCT_EVENTS.REGISTRATION_COMPLETED, {
  user_id: '123',
  auth_method: 'google',
})

// 3. Alias anonymous → registered (Mixpanel only)
// This happens automatically in the registration flow

// 4. Identify user
analytics.identify('user_id_123')

// 5. User logs out
analytics.reset()
```

## Troubleshooting

### Events not appearing in dashboards

1. Check feature flags: `NEXT_PUBLIC_ANALYTICS_ENABLED=true`
2. Check platform flags: `NEXT_PUBLIC_GA4_ENABLED=true`
3. Check tokens/IDs are set correctly
4. Enable debug mode: `NEXT_PUBLIC_ANALYTICS_DEBUG=true`
5. Check browser console for errors

### Duplicate page views

- Only use `usePageView()` hook in root layout
- Never call `track(PRODUCT_EVENTS.PAGE_VIEW)` manually

### Validation errors

- Check property names match schema exactly
- Check required properties are provided
- Check property types (string vs number)
- Enable debug mode to see validation details

## Files Structure

```
src/lib/analytics/
├── contracts/
│   ├── events.ts              # Event constants
│   ├── schemas.ts             # Zod validation schemas
│   └── destinations.ts        # Event routing config
├── core/
│   ├── tracker.ts             # Main track() function
│   └── validator.ts           # Schema validation
├── adapters/
│   ├── ga4/
│   │   ├── adapter.ts         # GA4 implementation
│   │   ├── scripts.tsx        # GA4 script loader
│   │   └── transform.ts       # Event transformation
│   └── mixpanel/
│       ├── adapter.ts         # Mixpanel implementation
│       ├── scripts.tsx        # Mixpanel script loader
│       └── transform.ts       # Event transformation
├── providers/
│   └── AnalyticsProvider.tsx  # React context provider
├── hooks/
│   └── usePageView.ts         # Page view tracking hook
├── config.ts                  # Environment configuration
├── types.ts                   # TypeScript types
├── index.ts                   # Public API
└── README.md                  # This file
```

## Testing

```bash
# Run integration tests
pnpm test:int tests/int/analytics

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Best Practices

1. **Use constants:** Always use `PRODUCT_EVENTS.XXX` constants
2. **Type safety:** Use exported TypeScript types for properties
3. **No PII:** Never send personal information
4. **Fail-safe:** Analytics must never break user flows
5. **Single source:** One place for each event type
6. **Validate early:** Add schema validation for new events
7. **Test coverage:** Add tests for new events
8. **Document:** Update this README when adding events

## Support

For questions or issues:

- Check this README first
- Review test files for examples
- Enable debug mode for troubleshooting
- Check browser console for errors
