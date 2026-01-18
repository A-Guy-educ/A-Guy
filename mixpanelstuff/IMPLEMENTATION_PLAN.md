# Product Events - Canonical Analytics Implementation Plan

**Status**: Ready for Manager Review
**Branch**: `feat/product-events-canonical` (new, from latest `dev`)
**Estimated Effort**: 8-12 hours (2-3 days)
**Date**: 2026-01-15

---

## Executive Summary

**Manager's Request**: Build a maintainable, reusable **Product Events** system at the component level with proper abstraction.

### Key Insight

Your feedback identified the core issue:
- ❌ Old AGuy: 152 events (too detailed, scattered across 20+ files)
- ❌ Original request: "Track everything" (too broad, dangerous)
- ✅ **NEW APPROACH**: 10 canonical product events with strict contract + clean architecture

### What This Plan Delivers

```
Product Code (Components/Pages)
        ↓
    track(event, payload)  ← Single function
        ↓
   Validation Layer (Zod schemas)
        ↓
    Adapter/Router
       ↙️    ↘️
    GA4   Mixpanel
```

**Core Principles** (from your spec.txt):
1. **Events over clicks** - Only track behavior with intent/value
2. **Canonical before tools** - Define events FIRST, then implement
3. **One source of truth** - Single event contract
4. **Tool separation** - GA4 for traffic, Mixpanel for product
5. **Governance first** - Feature flags, environment validation

---

## Top 10 Canonical Product Events

From your `spec.txt`:

| Event Name | Description | Destination | Priority |
|-----------|-------------|-------------|----------|
| `page_view` | Any page render | GA4 + Mixpanel | P0 |
| `session_started` | New user session | GA4 + Mixpanel | P0 |
| `user_identified` | Anonymous → identified | Mixpanel | P0 |
| `course_entered` | User enters a course | Mixpanel | P0 |
| `lesson_started` | Lesson begins | Mixpanel | P0 |
| `lesson_completed` | Lesson finished | Mixpanel | P0 |
| `pdf_viewed` | PDF content consumed | Mixpanel | P1 |
| `chat_message_sent` | User sends chat | Mixpanel | P1 |
| `registration_prompt_shown` | Soft gate displayed | Mixpanel | P0 |
| `registration_completed` | Signup success | GA4 + Mixpanel | P0 |

**Event Contract Example**:
```typescript
{
  event: 'lesson_started',
  properties: {
    lesson_id: string,      // required
    course_id: string,      // required
    lesson_title?: string,  // optional
  },
  destination: 'mixpanel'
}
```

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────┐
│   Product Code (Components/Pages)          │
│   - Never calls analytics SDKs directly    │
│   - Only uses: track(event, payload)       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│   Analytics Canonical Layer                 │
│   - Event contracts (strict types)          │
│   - Zod validation                          │
│   - Debug mode                              │
│   - Feature flags                           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│   Adapter / Router                          │
│   - Routes to correct platform              │
│   - Transforms to platform format           │
│   - Environment-aware                       │
└──────────────┬────────────┬─────────────────┘
               │            │
     ┌─────────▼──┐    ┌───▼──────────┐
     │    GA4     │    │   Mixpanel   │
     │ (Traffic)  │    │  (Product)   │
     └────────────┘    └──────────────┘
```

### Core API (Simple)

```typescript
import { analytics } from '@/lib/analytics'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'

// In any component
analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
  lesson_id: '123',
  course_id: '456',
  lesson_title: 'Introduction to Algebra',
})
```

**TypeScript autocomplete works** ✅
**Validation catches errors** ✅
**Zero direct SDK calls** ✅

---

## Implementation Phases

### Phase 1: Event Contract Definition (2 hours)

**Goal**: Define strict schemas for all 10 events

**Files Created**:
```
src/lib/analytics/
  ├── contracts/
  │   ├── events.ts              # Event constants
  │   ├── schemas.ts             # Zod validation schemas
  │   └── destinations.ts        # Routing rules
  ├── config.ts                  # Environment + feature flags
  └── types.ts                   # TypeScript types
```

**Deliverables**:
- Event constants: `PRODUCT_EVENTS.LESSON_STARTED`
- Zod schemas for validation
- Routing config: which events go where
- Property documentation

**Exit Criteria**:
- ✅ All 10 events defined with types
- ✅ Validation schemas complete
- ✅ `pnpm typecheck` passes

---

### Phase 2: Canonical Analytics Layer (2 hours)

**Goal**: Build core `track()` function with validation

**Files Created**:
```
src/lib/analytics/
  ├── core/
  │   ├── tracker.ts             # Main track() function
  │   ├── validator.ts           # Schema validation
  │   ├── debug.ts               # Debug logging
  │   └── queue.ts               # Event buffering (optional)
  ├── index.ts                   # Public API
  └── README.md                  # Usage docs
```

**Core Implementation**:
```typescript
export function track(event: ProductEvent, properties?: Record<string, any>): void {
  // 1. Validation
  const validated = validateEvent(event, properties)

  // 2. Feature flag check
  if (!analyticsConfig.enabled) {
    if (analyticsConfig.debugMode) {
      console.log('[Analytics] Disabled:', event, validated)
    }
    return
  }

  // 3. Debug mode
  if (analyticsConfig.debugMode) {
    console.log('[Analytics] Track:', event, validated)
  }

  // 4. Route to destinations
  const destinations = eventDestinations[event]

  if (destinations.includes('ga4')) sendToGA4(event, validated)
  if (destinations.includes('mixpanel')) sendToMixpanel(event, validated)
}
```

**Exit Criteria**:
- ✅ `track()` validates properties
- ✅ Debug mode logs events
- ✅ Feature flags work
- ✅ Dry-run mode (logs without sending)
- ✅ Tests pass

---

### Phase 3: Platform Adapters (2 hours)

**Goal**: Build GA4 and Mixpanel adapters

**Files Created**:
```
src/lib/analytics/
  └── adapters/
      ├── ga4/
      │   ├── adapter.ts         # GA4 implementation
      │   ├── scripts.tsx        # GA4 <Script> component
      │   └── transform.ts       # Event transformation
      └── mixpanel/
          ├── adapter.ts         # Mixpanel implementation
          ├── scripts.tsx        # Mixpanel <Script> component
          └── transform.ts       # Event transformation
```

**GA4 Adapter Example**:
```typescript
export function sendToGA4(event: ProductEvent, properties: Record<string, any>): void {
  if (!analyticsConfig.ga4.enabled) return

  const ga4Event = transformToGA4(event, properties)

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', ga4Event.name, ga4Event.params)
  }
}
```

**Script Components**:
```tsx
export function GA4Scripts() {
  const measurementId = analyticsConfig.ga4.measurementId

  if (!analyticsConfig.enabled || !measurementId) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} />
      <Script id="ga4-init">{`...gtag initialization...`}</Script>
    </>
  )
}
```

**Exit Criteria**:
- ✅ GA4 adapter sends events correctly
- ✅ Mixpanel adapter sends events correctly
- ✅ Scripts load only when enabled
- ✅ Environment variables control activation

---

### Phase 4: Integration Layer (1-2 hours)

**Goal**: Connect to app layout and create React hooks

**Files Created/Modified**:
```
src/lib/analytics/
  ├── hooks/
  │   ├── useAnalytics.ts        # Main hook
  │   ├── usePageView.ts         # Auto page tracking
  │   └── useIdentify.ts         # User identification
  └── providers/
      └── AnalyticsProvider.tsx  # Context provider

Modified:
src/app/(frontend)/layout.tsx    # Add provider
```

**Usage Example**:
```tsx
// In any component
import { useAnalytics } from '@/lib/analytics'
import { PRODUCT_EVENTS } from '@/lib/analytics/contracts/events'

function LessonPage({ lesson }) {
  const analytics = useAnalytics()

  useEffect(() => {
    analytics.track(PRODUCT_EVENTS.LESSON_STARTED, {
      lesson_id: lesson.id,
      course_id: lesson.courseId,
      lesson_title: lesson.title,
    })
  }, [lesson.id])

  return <div>Lesson content...</div>
}
```

**Exit Criteria**:
- ✅ Provider wraps app
- ✅ Scripts load correctly
- ✅ Page views auto-track
- ✅ TypeScript autocomplete works

---

### Phase 5: Event Implementation (2 hours)

**Goal**: Integrate all 10 events into product code

**Integration Points**:

| Event | Location | Trigger |
|-------|----------|---------|
| `page_view` | Global layout | Automatic via hook |
| `session_started` | Global layout | First mount |
| `user_identified` | Auth callback | After login/signup |
| `course_entered` | Course page | Page mount |
| `lesson_started` | Lesson page | Page mount |
| `lesson_completed` | Lesson page | Click "Complete" |
| `pdf_viewed` | PDF component | Render complete |
| `chat_message_sent` | Chat input | Submit message |
| `registration_prompt_shown` | Modal | Modal opens |
| `registration_completed` | Auth callback | Signup success |

**Exit Criteria**:
- ✅ All 10 events fire correctly
- ✅ Properties match schemas
- ✅ Events route to correct platforms
- ✅ Manual testing complete

---

### Phase 6: Governance & Testing (1-2 hours)

**Goal**: Feature flags, tests, approval workflow

**Files Created**:
```
src/lib/analytics/
  └── governance/
      ├── feature-flags.ts       # Flag management
      ├── environment.ts         # Env validation
      └── approval.ts            # Approval workflow

tests/int/analytics/
  ├── tracker.int.spec.ts        # Core tests
  ├── validation.int.spec.ts     # Schema tests
  ├── routing.int.spec.ts        # Routing tests
  └── adapters.int.spec.ts       # Adapter tests
```

**Feature Flags**:
```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=false      # Master switch
NEXT_PUBLIC_ANALYTICS_DEBUG=true         # Debug logging
NEXT_PUBLIC_ANALYTICS_DRY_RUN=true      # Log without sending

NEXT_PUBLIC_GA4_ENABLED=false
NEXT_PUBLIC_GA4_MEASUREMENT_ID=

NEXT_PUBLIC_MIXPANEL_ENABLED=false
NEXT_PUBLIC_MIXPANEL_TOKEN=
```

**Exit Criteria**:
- ✅ All tests pass
- ✅ Feature flags work
- ✅ Environment validation catches misconfig
- ✅ `pnpm typecheck && pnpm lint && pnpm build` passes

---

## Environment Configuration

### Development (Local)
```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_DEBUG=true
NEXT_PUBLIC_ANALYTICS_DRY_RUN=true    # Don't send to real platforms

NEXT_PUBLIC_GA4_ENABLED=false
NEXT_PUBLIC_MIXPANEL_ENABLED=false
```

### Staging
```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_DEBUG=true
NEXT_PUBLIC_ANALYTICS_DRY_RUN=false

NEXT_PUBLIC_GA4_ENABLED=true
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-49KEEFY1WE

NEXT_PUBLIC_MIXPANEL_ENABLED=true
NEXT_PUBLIC_MIXPANEL_TOKEN=4472fb6738b41a819dbbf76fad44108e
```

### Production
```bash
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_ANALYTICS_DRY_RUN=false

NEXT_PUBLIC_GA4_ENABLED=true
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-M1QKYGXWVM

NEXT_PUBLIC_MIXPANEL_ENABLED=true
NEXT_PUBLIC_MIXPANEL_TOKEN=4472fb6738b41a819dbbf76fad44108e

ANALYTICS_APPROVED_BY_IDO=true  # Required for production
```

---

## Governance & Approval Process

### Stage 1: Infrastructure (No Connections)
**Duration**: 4-6 hours
**Approval**: Your review

**Tasks**:
- Phases 1-2: Event contracts + canonical layer
- Tests pass
- Documentation complete

**Approval Checklist**:
- ✅ Event contracts defined
- ✅ Validation works
- ✅ Architecture clean and maintainable
- ✅ You approve approach

**Exit**: You say "proceed to staging"

---

### Stage 2: Staging Integration
**Duration**: 3-4 hours
**Approval**: Ido approval required

**Prerequisites**:
- ✅ Ido verifies GA4 staging: **G-49KEEFY1WE**
- ✅ Ido verifies Mixpanel token: **4472fb6738b41a819dbbf76fad44108e**
- ✅ Ido confirms staging domain

**Tasks**:
- Phases 3-5: Adapters + integration + events
- Deploy to staging
- Manual testing: Complete user journey
- Verify in GA4/Mixpanel dashboards

**Verification**:
1. Open staging site
2. Complete full user flow:
   - Land on homepage (page_view ✓)
   - Browse course (course_entered ✓)
   - Start lesson (lesson_started ✓)
   - Complete lesson (lesson_completed ✓)
   - Send chat message (chat_message_sent ✓)
3. Check GA4 Real-Time: See events
4. Check Mixpanel Events: See all product events

**Exit**: All 10 events verified in dashboards

---

### Stage 3: Production Rollout
**Duration**: 1-2 hours
**Approval**: Ido + your final sign-off

**Prerequisites**:
- ✅ Staging validation complete
- ✅ Ido approves production GA4: **G-M1QKYGXWVM**
- ✅ You approve go-live
- ✅ `ANALYTICS_APPROVED_BY_IDO=true` set

**Tasks**:
- Update production env vars
- Deploy to production
- Monitor for 24 hours

**Monitoring**:
- Check Sentry for analytics errors
- Verify events in GA4/Mixpanel
- Monitor performance impact
- Check for duplicate events

**Rollback Plan**:
- Set `NEXT_PUBLIC_ANALYTICS_ENABLED=false`
- Deploy updated env var
- No code changes needed

**Exit**: 24 hours stable, no errors

---

## File Structure

### Complete Directory Tree

```
src/lib/analytics/
├── contracts/
│   ├── events.ts              # Top 10 canonical events
│   ├── schemas.ts             # Zod validation schemas
│   └── destinations.ts        # Event routing config
├── core/
│   ├── tracker.ts             # Main track() function
│   ├── validator.ts           # Schema validation
│   ├── debug.ts               # Debug logging
│   └── queue.ts               # Event buffering (optional)
├── adapters/
│   ├── ga4/
│   │   ├── adapter.ts         # GA4 implementation
│   │   ├── scripts.tsx        # GA4 <Script> component
│   │   └── transform.ts       # Event transformation
│   └── mixpanel/
│       ├── adapter.ts         # Mixpanel implementation
│       ├── scripts.tsx        # Mixpanel <Script> component
│       └── transform.ts       # Event transformation
├── hooks/
│   ├── useAnalytics.ts        # Main analytics hook
│   ├── usePageView.ts         # Auto page tracking
│   └── useIdentify.ts         # User identification
├── providers/
│   └── AnalyticsProvider.tsx  # Context provider
├── governance/
│   ├── feature-flags.ts       # Flag management
│   ├── environment.ts         # Env validation
│   └── approval.ts            # Approval workflow
├── config.ts                  # Configuration
├── types.ts                   # TypeScript types
├── index.ts                   # Public API
└── README.md                  # Documentation

tests/int/analytics/
├── tracker.int.spec.ts        # Core tracker tests
├── validation.int.spec.ts     # Schema validation tests
├── routing.int.spec.ts        # Event routing tests
└── adapters.int.spec.ts       # Adapter tests
```

---

## Key Differences: Old vs New

| Aspect | Old AGuy (152 events) | New Product Events (10 events) |
|--------|----------------------|-------------------------------|
| **Philosophy** | Event-first, detailed | Canonical, minimal, intentional |
| **Event Count** | 152 tracking calls | 10 canonical events |
| **Architecture** | Direct SDK calls | Single abstraction layer |
| **Naming** | Descriptive (Grade 7 Unit 4...) | Canonical (lesson_started) |
| **Validation** | No validation | Strict Zod schemas |
| **Governance** | Implicit | Explicit feature flags |
| **Testing** | Manual only | Integration test suite |
| **Destinations** | Both platforms for all | Strategic routing |
| **Maintainability** | Scattered (20+ files) | Centralized system |

---

## Event Taxonomy & Naming

From your feedback (chatgpt-chat.txt):

```
page_view.*          # Page-level events
user.auth.*          # Authentication events
course.entered       # Course interaction
lesson.started       # Lesson events
lesson.completed
chat.message.sent    # Chat interactions
```

**Canonical Naming Rules**:
- Lowercase with underscores: `lesson_started` ✅
- Past tense for completed: `lesson_completed` ✅
- Present tense for ongoing: `page_view` ✅
- No prefixes: not `event:lesson_started` ❌

**Consistency Examples**:
- ✅ `page_view` (not `Page Viewed`, `page_loaded`, `pageView`)
- ✅ `lesson_started` (not `Lesson Started`, `lessonStart`)
- ✅ `user_identified` (not `User Login`, `identify`)

---

## Success Criteria

**Definition of Done**:
- ✅ Top 10 canonical events implemented
- ✅ Single `track()` abstraction
- ✅ Zero direct SDK calls in product code
- ✅ Strict schema validation (Zod)
- ✅ Event routing to correct platforms
- ✅ Feature flags control behavior
- ✅ Debug + dry-run modes work
- ✅ Environment validation enforced
- ✅ Integration tests pass
- ✅ Manual testing complete
- ✅ Ido approval received
- ✅ Manager approval received
- ✅ Production stable for 24 hours
- ✅ Documentation complete

**Quality Gates**:
```bash
pnpm typecheck      # TypeScript compilation
pnpm lint           # ESLint checks
pnpm build          # Next.js build succeeds
pnpm test:int       # Integration tests pass
```

---

## Critical Constraints (From Your Feedback)

### ✅ MUST DO

1. **Canonical Event Contract** - Strict schema for all events
2. **Single Abstraction Layer** - One `track()` function
3. **Zero Direct SDK Calls** - No `window.gtag()` or `window.mixpanel` in code
4. **Event Taxonomy** - Consistent naming (lowercase_underscores)
5. **Tool Separation** - GA4 for traffic, Mixpanel for product
6. **Feature Flags** - Environment-safe with governance
7. **Validation** - Zod schemas catch errors at runtime
8. **Minimal Events** - Only 10 canonical events (not 152)

### ❌ MUST NOT DO

1. **"Track Everything"** - Dangerous, creates noise
2. **Direct SDK Calls** - Breaks abstraction
3. **Auto-Tracking** - No scrolls, hovers, generic clicks
4. **Ad-Hoc Events** - No `track('random_event')` without schema
5. **Session Recording** - Not this phase
6. **Porting Old AGuy** - Different philosophy (152 events vs 10)

---

## Questions for Review

### Critical (Blocking)
1. **Top 10 Events Confirmed?** - Are these the correct 10 canonical events?
2. **Property Schemas** - Do you want to review property definitions before implementation?
3. **Ido Coordination** - Should we schedule approval meeting for staging?

### Important (Non-Blocking)
4. **Debug Mode in Production?** - Allow `ANALYTICS_DEBUG=true` in prod?
5. **Event Expansion Process** - How do we add an 11th event later?
6. **Dry-Run Testing Duration** - How long in dry-run before staging?

---

## Next Steps

### For Developer
1. ✅ Pull latest `dev`: `git checkout dev && git pull origin dev`
2. ✅ Create branch: `git checkout -b feat/product-events-canonical`
3. ✅ Get manager approval
4. 🚀 Start Phase 1: Event contract definition

### For You (Manager)
1. ✅ Review this plan
2. ✅ Confirm top 10 events correct
3. ✅ Approve architecture approach
4. 📞 Coordinate Ido approval for staging
5. ✅ Approve Phase 1 start (no connections yet)

### For Ido
1. Review governance process
2. Verify staging environment IDs:
   - GA4: **G-49KEEFY1WE** → Domain?
   - Mixpanel: **4472fb6738b41a819dbbf76fad44108e** → Project?
3. Schedule approval for Stage 2 (staging)
4. Schedule approval for Stage 3 (production)

---

## References

**Your Specifications**:
- [High-Level Spec](spec.txt) - Top 10 canonical events
- [Your Feedback](chatgpt-chat.txt) - Architecture guidance
- [Old AGuy Data Spec](ANALYTICS_DATA_SPEC.md) - Reference only

**Current Codebase**:
- `src/app/(frontend)/layout.tsx` - Integration point
- `src/instrumentation-client.ts` - Script loading pattern

**Project Guidelines**:
- `docs/specs/CONSTRAINTS.md` - Engineering constraints
- `docs/specs/COMMIT_GUIDE.md` - Commit standards

---

**Plan Status**: ✅ Ready for Manager Review
**Created**: 2026-01-15
**Next Action**: Manager approval → Phase 1 implementation
**Timeline**: 8-12 hours (2-3 days)

---

## Summary: What You're Getting

**Architecture**: Clean, maintainable, reusable system components
**Events**: 10 strategic events (not 152 scattered ones)
**Code Quality**: TypeScript + Zod validation + integration tests
**Governance**: Feature flags, approvals, environment-safe
**Developer Experience**: Simple API, autocomplete, clear errors
**Tool Separation**: GA4 for traffic, Mixpanel for product
**Zero Technical Debt**: Single source of truth, no direct SDK calls

This is the **canonical event system** you specified in your feedback. 🎯
