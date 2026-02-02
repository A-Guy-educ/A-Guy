# Analytics Tracking & Governance Implementation Plan

## Overview

Complete the analytics setup for GA4 + Mixpanel with proper token configuration, time-to-abandonment tracking, and environment governance.

## Current State

✅ **Already Implemented:**
- GA4 adapter fully integrated (`src/infra/analytics/adapters/ga4/`)
- Mixpanel adapter fully integrated (`src/infra/analytics/adapters/mixpanel/`)
- Session recording at 100% with text unmasking
- 10 canonical events tracked
- Environment-based enablement via presence of tokens
- Session tracking via sessionStorage

❌ **Needs Implementation:**
- Update to correct GA4 measurement IDs and Mixpanel token
- Environment-based token selection (prod vs temp GA4)
- Enable Mixpanel autocapture
- Time-to-abandonment tracking
- Governance confirmation with Ido

## Implementation Steps

### 1. Update Environment Variables

**File:** `.env.example`

Add multiple GA4 measurement IDs to support production and temporary/pre-launch environments:

```bash
# Google Analytics 4
# Production GA4
NEXT_PUBLIC_GA4_MEASUREMENT_ID_PROD=G-M1QKYGXWVM

# Temporary / Pre-Launch GA4 (for staging/testing)
NEXT_PUBLIC_GA4_MEASUREMENT_ID_TEMP=G-49KEEFY1WE

# Current active GA4 (set to one of the above)
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-49KEEFY1WE

# Mixpanel
NEXT_PUBLIC_MIXPANEL_TOKEN=4472fb6738b41a819dbbf76fad44108e
```

**Rationale:**
- Keep both GA4 IDs documented
- Use `NEXT_PUBLIC_GA4_MEASUREMENT_ID` as the active one
- Prevents both GA4s from loading simultaneously
- Easy to switch between environments by changing one variable

### 2. Enable Mixpanel Autocapture

**File:** `src/infra/analytics/adapters/mixpanel/scripts.tsx`

**Current (line 95):**
```typescript
track_pageview: false,
```

**Change to:**
```typescript
track_pageview: true,
autocapture: true,
```

**Trade-offs:**
- ✅ Pro: Captures all click events automatically (comprehensive tracking)
- ✅ Pro: No manual event instrumentation needed
- ❌ Con: Can create noisy data with generic event names
- ❌ Con: May capture more than needed

**Note:** Task explicitly requires `autocapture: true`. Current architecture has it disabled for cleaner, intentional tracking. **Need to confirm with Ido if autocapture is truly required or if current explicit tracking is sufficient.**

### 3. Add Time-to-Abandonment Tracking

Create new tracking for session duration and abandonment points.

#### 3a. Add New Events

**File:** `src/infra/analytics/contracts/events.ts`

Add new event types:
```typescript
export const PRODUCT_EVENTS = {
  // ... existing events ...

  // Session lifecycle
  SESSION_ENDED: 'session_ended',
  PAGE_ABANDONED: 'page_abandoned',
  VISIBILITY_CHANGED: 'visibility_changed',
} as const
```

#### 3b. Add Event Schemas

**File:** `src/infra/analytics/contracts/schemas.ts`

```typescript
const sessionEndedSchema = z.object({
  session_id: z.string(),
  duration_seconds: z.number(),
  page_views_count: z.number(),
  last_active_page: z.string().optional(),
})

const pageAbandonedSchema = z.object({
  page_url: z.string(),
  time_on_page_seconds: z.number(),
  scroll_depth_percent: z.number().optional(),
})

const visibilityChangedSchema = z.object({
  visibility_state: z.enum(['visible', 'hidden']),
  time_on_page_seconds: z.number(),
})

export const productEventSchemas: ProductEventSchemas = {
  // ... existing schemas ...
  [PRODUCT_EVENTS.SESSION_ENDED]: sessionEndedSchema,
  [PRODUCT_EVENTS.PAGE_ABANDONED]: pageAbandonedSchema,
  [PRODUCT_EVENTS.VISIBILITY_CHANGED]: visibilityChangedSchema,
}
```

#### 3c. Add Event Destinations

**File:** `src/infra/analytics/contracts/destinations.ts`

```typescript
const eventDestinations: EventDestinations = {
  // ... existing mappings ...

  [PRODUCT_EVENTS.SESSION_ENDED]: ['mixpanel', 'ga4'],
  [PRODUCT_EVENTS.PAGE_ABANDONED]: ['mixpanel'],
  [PRODUCT_EVENTS.VISIBILITY_CHANGED]: ['mixpanel'],
}
```

#### 3d. Create Session Duration Tracker

**New File:** `src/infra/analytics/hooks/useSessionDuration.ts`

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { analytics } from '../index'
import { PRODUCT_EVENTS } from '../contracts/events'

export function useSessionDuration() {
  const sessionStartTime = useRef<number>(Date.now())
  const pageViewCount = useRef<number>(0)
  const lastActivePage = useRef<string>(window.location.pathname)

  useEffect(() => {
    // Track page view count
    pageViewCount.current += 1
    lastActivePage.current = window.location.pathname

    // Track session end on beforeunload
    const handleBeforeUnload = () => {
      const durationSeconds = Math.floor((Date.now() - sessionStartTime.current) / 1000)

      analytics.track(PRODUCT_EVENTS.SESSION_ENDED, {
        session_id: analytics.getSessionId(),
        duration_seconds: durationSeconds,
        page_views_count: pageViewCount.current,
        last_active_page: lastActivePage.current,
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])
}
```

#### 3e. Create Page Abandonment Tracker

**New File:** `src/infra/analytics/hooks/usePageAbandonment.ts`

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { analytics } from '../index'
import { PRODUCT_EVENTS } from '../contracts/events'

export function usePageAbandonment() {
  const pathname = usePathname()
  const pageStartTime = useRef<number>(Date.now())
  const maxScroll = useRef<number>(0)

  useEffect(() => {
    // Reset timer on page change
    pageStartTime.current = Date.now()
    maxScroll.current = 0

    // Track scroll depth
    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      )
      maxScroll.current = Math.max(maxScroll.current, scrollPercent)
    }

    // Track visibility changes (tab switching)
    const handleVisibilityChange = () => {
      const timeOnPage = Math.floor((Date.now() - pageStartTime.current) / 1000)

      analytics.track(PRODUCT_EVENTS.VISIBILITY_CHANGED, {
        visibility_state: document.visibilityState as 'visible' | 'hidden',
        time_on_page_seconds: timeOnPage,
      })

      // If user is leaving the tab, track as potential abandonment
      if (document.visibilityState === 'hidden') {
        analytics.track(PRODUCT_EVENTS.PAGE_ABANDONED, {
          page_url: window.location.pathname,
          time_on_page_seconds: timeOnPage,
          scroll_depth_percent: maxScroll.current,
        })
      }
    }

    window.addEventListener('scroll', handleScroll)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname])
}
```

#### 3f. Integrate Hooks into Layout

**File:** `src/app/(frontend)/LayoutClient.tsx`

```typescript
import { usePageView } from '@/infra/analytics/hooks/usePageView'
import { useSessionDuration } from '@/infra/analytics/hooks/useSessionDuration'
import { usePageAbandonment } from '@/infra/analytics/hooks/usePageAbandonment'

export function LayoutClient() {
  usePageView()
  useSessionDuration()
  usePageAbandonment()
  return null
}
```

### 4. Update GA4 Transform for New Events

**File:** `src/infra/analytics/adapters/ga4/transform.ts`

Add mapping for new events:

```typescript
const eventNameMap: Record<string, string> = {
  // ... existing mappings ...
  session_ended: 'session_end',
}
```

### 5. Environment Configuration Documentation

**File:** `docs/analytics-environment-setup.md` (NEW)

Create documentation explaining:
- Which tokens to use for which environment
- How to switch between production and temp GA4
- Governance process (must confirm with Ido)
- How to verify correct configuration
- Testing checklist

### 6. Governance Checklist

Before deploying, confirm with Ido:

- [ ] Correct environment (prod / staging / dev)
- [ ] Correct domain / URL
- [ ] Correct GA4 property (prod vs temp)
- [ ] Correct Mixpanel project
- [ ] Session recordings enabled and visible
- [ ] No duplicate tracking
- [ ] Events appearing in dashboards

## Testing & Verification

### Local Testing

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Open browser DevTools Console**

3. **Verify analytics loads:**
   - Check for `[Analytics/GA4] Initialized` log
   - Check for `[Analytics/Mixpanel] Initialized with anonymous ID` log

4. **Test page views:**
   - Navigate between pages
   - Check console for `[Analytics] Sent:` logs
   - Verify `page_view` events

5. **Test session duration:**
   - Stay on site for 30+ seconds
   - Switch tabs (should trigger `visibility_changed`)
   - Close tab (should trigger `session_ended`)

6. **Test abandonment tracking:**
   - Open page, scroll halfway
   - Switch to another tab
   - Check for `page_abandoned` event

### Dashboard Verification

**GA4 (https://analytics.google.com):**
1. Go to Reports > Realtime
2. Verify events appearing:
   - `page_view`
   - `session_start`
   - `sign_up` (registration_completed)
   - `session_end` (session_ended)
3. Check for duplicate events (should be none)

**Mixpanel (https://mixpanel.com):**
1. Go to Activity Feed
2. Verify events appearing:
   - All 10+ canonical events
   - New: `session_ended`, `page_abandoned`, `visibility_changed`
3. Check Session Replay
4. Verify text is visible (not masked)
5. Check for duplicate events

### No Duplicate Events Test

**Scenario:** User loads page, navigates, closes tab

**Expected:**
- 1x `session_started` (on first load)
- 1x `page_view` per page navigation
- 1x `session_ended` (on tab close)
- No duplicate page views
- No duplicate session starts

**How to verify:**
- Check Mixpanel Activity Feed
- Filter by your session ID
- Count occurrences of each event
- Should see exactly 1 of each (except page_view which should match navigation count)

## Critical Files

### Files to Modify:
1. `.env.example` - Add GA4 prod/temp IDs
2. `src/infra/analytics/adapters/mixpanel/scripts.tsx` - Enable autocapture (if confirmed)
3. `src/infra/analytics/contracts/events.ts` - Add new events
4. `src/infra/analytics/contracts/schemas.ts` - Add new schemas
5. `src/infra/analytics/contracts/destinations.ts` - Add event routing
6. `src/infra/analytics/adapters/ga4/transform.ts` - Add session_ended mapping
7. `src/app/(frontend)/LayoutClient.tsx` - Add new hooks

### Files to Create:
1. `src/infra/analytics/hooks/useSessionDuration.ts` - Session duration tracking
2. `src/infra/analytics/hooks/usePageAbandonment.ts` - Page abandonment tracking
3. `docs/analytics-environment-setup.md` - Environment documentation

## Open Questions (Need Clarification)

### 1. Autocapture Decision
**Question:** Should we enable Mixpanel autocapture?

**Context:**
- Task says `autocapture: true`
- Current architecture has it disabled for intentional, clean tracking
- Autocapture creates noisy data but captures everything

**Options:**
- A) Enable it as task requires (comprehensive but noisy)
- B) Keep it disabled and use explicit tracking (clean but requires instrumentation)

**Recommendation:** Clarify with Ido - does he want autocapture for quick wins, or prefer the current explicit tracking approach?

### 2. Environment Strategy
**Question:** How to manage prod vs temp GA4?

**Current approach:** Use `NEXT_PUBLIC_GA4_MEASUREMENT_ID` and manually switch value

**Alternative:** Use runtime detection based on domain:
```typescript
const measurementId = window.location.hostname === 'app.aguy.co.il'
  ? 'G-M1QKYGXWVM' // Production
  : 'G-49KEEFY1WE' // Staging/Temp
```

**Recommendation:** Stick with env var approach for explicit control and verifiability.

### 3. Session End Reliability
**Question:** How reliable is `beforeunload` event?

**Context:**
- `beforeunload` may not fire on mobile
- Some browsers throttle it
- Tab crashes won't trigger it

**Mitigation:**
- Use Page Visibility API as backup
- Track `visibility_changed` with hidden state as proxy for abandonment
- Accept that some sessions won't have explicit end event

## Risks & Mitigations

### Risk 1: Duplicate Tracking
**Scenario:** Both production and temp GA4 load simultaneously

**Mitigation:**
- Only set ONE `NEXT_PUBLIC_GA4_MEASUREMENT_ID` per environment
- Document clearly in `.env.example`
- Add validation warning if both prod/temp IDs are set

### Risk 2: Token Leakage
**Scenario:** Production tokens committed to git

**Mitigation:**
- Never commit actual `.env` file
- Use `.env.example` with placeholder values
- Add pre-commit hook to block commits with actual tokens

### Risk 3: Wrong Token in Wrong Environment
**Scenario:** Production GA4 used in staging, contaminating data

**Mitigation:**
- Require governance confirmation with Ido before deployment
- Add console warning showing which tokens are active
- Document token ownership in README

### Risk 4: Performance Impact
**Scenario:** Too many tracking events slow down the app

**Mitigation:**
- Throttle scroll tracking (max 1 event per second)
- Use `requestIdleCallback` for non-critical tracking
- Make all tracking async and non-blocking

## Success Criteria

✅ GA4 and Mixpanel load globally on all pages
✅ Events visible in both dashboards within 30 seconds
✅ Session recordings show full UI (no masking)
✅ Session duration tracked correctly
✅ Abandonment points identified
✅ No duplicate page views or sessions
✅ Correct tokens for environment
✅ Governance confirmed with Ido
✅ Documentation complete

## Timeline Estimate

- Environment config: 30 min
- New events/schemas: 1 hour
- Session duration hook: 1 hour
- Page abandonment hook: 1 hour
- Testing & verification: 1-2 hours
- Documentation: 30 min
- Governance review with Ido: 30 min

**Total:** ~5-6 hours

## Next Steps After Plan Approval

1. Create new branch: `feat/analytics-tracking-governance`
2. Update environment variables
3. Implement new events and schemas
4. Create tracking hooks
5. Test locally
6. Commit and push
7. Deploy to staging
8. Verify in dashboards
9. Get Ido's confirmation
10. Deploy to production
