# BUG: Mixpanel Anonymous User Tracking

**Status**: Ready for Implementation
**Priority**: High
**Created**: 2026-01-31
**Last Updated**: 2026-01-31

---

## Problem Statement

Anonymous users are not being properly identified in Mixpanel, preventing funnel tracking and user journey analysis.

### Current Behavior

- Anonymous users do not appear as distinct users in Mixpanel
- Their event history cannot be followed across sessions
- Funnels and user journeys are incomplete or unusable
- Cannot analyze conversion paths prior to registration/login

### Root Cause Analysis

After investigating the codebase, the following issues were identified:

1. **Relying solely on Mixpanel SDK's internal storage**
   - Location: [src/infra/analytics/adapters/mixpanel/scripts.tsx](../src/infra/analytics/adapters/mixpanel/scripts.tsx)
   - Mixpanel SDK uses localStorage by default, which can be:
     - Cleared by users
     - Blocked by privacy settings
     - Not accessible server-side

2. **No persistent cookie-based anonymous ID**
   - We don't generate or persist our own anonymous ID
   - No HTTP cookie is set for cross-session tracking
   - `getDistinctId()` exists in [adapter.ts:205-218](../src/infra/analytics/adapters/mixpanel/adapter.ts#L205-L218) but isn't used to persist/restore IDs

3. **Aliasing function exists but is never called**
   - `aliasUser()` is implemented in [adapter.ts:140-173](../src/infra/analytics/adapters/mixpanel/adapter.ts#L140-L173)
   - However, `REGISTRATION_COMPLETED` handler in [system-events-subscriber.ts:188-203](../src/infra/analytics/system-events-subscriber.ts#L188-L203) only calls `identify()`, NOT `alias()`
   - This breaks the anonymous → registered user identity merge

4. **No Mixpanel People profiles for anonymous users**
   - Anonymous users never get `people.set()` called
   - They don't appear in Mixpanel's Users list
   - Only authenticated users get People profiles (via `user_identified` event)

### Current Flow vs Required Flow

| Step           | Current (Broken)                       | Required (Fixed)                   |
| -------------- | -------------------------------------- | ---------------------------------- |
| First visit    | Mixpanel SDK generates ID internally   | Generate ID + store in HTTP cookie |
| Page load      | SDK retrieves from its own storage     | Read from cookie, pass to SDK      |
| Events         | SDK auto-attaches its ID (unreliable)  | Use consistent cookie-based ID     |
| People profile | Not created for anonymous              | Create profile on first event      |
| Registration   | `identify()` called, but NOT `alias()` | Call `alias()` THEN `identify()`   |

---

## Expected Behavior

1. Every anonymous user should be identified in Mixpanel with a unique `distinct_id`
2. All events fired by anonymous users should be associated with that user
3. Anonymous users should appear in Mixpanel as users (not just raw events)
4. Their full event history should be preserved and queryable
5. On registration, anonymous history should merge with the new user account

---

## Required Changes

### 1. Anonymous ID Cookie Management

- Generate unique anonymous ID on first interaction (page load event)
- Persist in HTTP cookie (not just localStorage)
- Cookie name: `mp_anon_id`
- Expiry: 1 year
- Flags: `SameSite=Lax`, `Secure` (in production)

### 2. Mixpanel SDK Initialization

- Read anonymous ID from cookie before SDK init
- Configure SDK with cookie-based persistence
- Sync our cookie ID with Mixpanel's `distinct_id`

### 3. Identity Aliasing on Registration

- Call `alias(userId, anonymousId)` BEFORE `identify(userId)`
- Only alias if user was previously anonymous
- Prevent duplicate aliasing (existing flag check is good)

### 4. Anonymous User People Profiles

- Call `people.set()` on first anonymous interaction
- Set `$created`, `$browser`, `$os`, `initial_referrer`
- Update `last_seen` on subsequent events

### 5. Logout / Reset Behavior

- Clear `mp_anon_id` cookie on logout
- Generate new anonymous ID for new session
- Call `mixpanel.reset()` to clear SDK state

---

## Acceptance Criteria

- [ ] Anonymous users appear in Mixpanel user lists
- [ ] Events from the same anonymous user are grouped correctly
- [ ] Funnels can be built and analyzed for anonymous users
- [ ] User journey is preserved before and after registration (via aliasing)
- [ ] Anonymous ID persists across browser sessions
- [ ] New anonymous ID is generated after logout

---

## Out of Scope

- Funnel optimization
- Analytics dashboards
- Behavior analysis or insights
- Server-side tracking (client-side only for now)

---

## TDD Test Plan

### Test Structure Overview

| Category    | Purpose                                 | Location                | Naming Convention |
| ----------- | --------------------------------------- | ----------------------- | ----------------- |
| Unit        | Anonymous ID generation, cookie helpers | `tests/unit/analytics/` | `*.test.ts`       |
| Integration | End-to-end flow, aliasing, persistence  | `tests/int/analytics/`  | `*.int.spec.ts`   |
| E2E         | Real browser verification               | `tests/e2e/analytics/`  | `*.e2e.spec.ts`   |

---

### Phase 1: Cookie Utilities

**Test File**: `tests/unit/analytics/cookies.test.ts`

```typescript
describe('Cookie Utilities', () => {
  describe('getCookie()', () => {
    it('should return value when cookie exists')
    it('should return null when cookie does not exist')
    it('should parse cookie with special characters correctly')
  })

  describe('setCookie()', () => {
    it('should set cookie with correct name')
    it('should set cookie with 1 year expiry')
    it('should set SameSite=Lax attribute')
    it('should set Secure flag in production')
  })

  describe('deleteCookie()', () => {
    it('should remove cookie by setting max-age to 0')
  })
})
```

**Test File**: `tests/unit/analytics/anonymous-id.test.ts`

```typescript
describe('Anonymous ID Management', () => {
  describe('generateAnonymousId()', () => {
    it('should generate a UUID v4 format ID')
    it('should generate unique IDs on each call')
    it('should prefix with "anon_" for easy identification')
  })

  describe('getOrCreateAnonymousId()', () => {
    it('should return existing ID from cookie if present')
    it('should generate and store new ID if cookie is missing')
    it('should handle cookie read errors gracefully')
  })

  describe('setAnonymousIdCookie()', () => {
    it('should set cookie with correct name "mp_anon_id"')
    it('should set cookie with 1 year expiry')
    it('should set cookie as HttpOnly: false (needs client access)')
    it('should set SameSite=Lax for cross-page navigation')
    it('should set Secure flag in production')
  })

  describe('clearAnonymousIdCookie()', () => {
    it('should remove the anonymous ID cookie')
    it('should be called on user logout')
  })
})
```

**Implementation**:

- `src/infra/analytics/utils/cookies.ts`
- `src/infra/analytics/utils/anonymous-id.ts`

---

### Phase 2: Mixpanel Initialization with Cookie ID

**Test File**: `tests/unit/analytics/mixpanel-init.test.ts`

```typescript
describe('Mixpanel Initialization', () => {
  describe('initializeMixpanelWithAnonymousId()', () => {
    it('should read anonymous ID from cookie before SDK init')
    it('should generate new ID if cookie is missing')
    it('should call mixpanel.init() with persistence: "localStorage+cookie"')
    it('should call mixpanel.identify() with the anonymous ID immediately after init')
    it('should NOT call identify if SDK already has matching distinct_id')
  })

  describe('SDK Configuration', () => {
    it('should set cross_subdomain_cookie: true for multi-subdomain support')
    it('should set cookie_expiration: 365 (1 year)')
    it('should set secure_cookie: true in production')
  })
})
```

**Implementation**: Update `src/infra/analytics/adapters/mixpanel/scripts.tsx`

---

### Phase 3: Identity Aliasing on Registration

**Test File**: `tests/int/analytics/identity-aliasing.int.spec.ts`

```typescript
describe('Identity Aliasing', () => {
  describe('REGISTRATION_COMPLETED event handler', () => {
    it('should call aliasUser() with user_id and anonymous_id')
    it('should call aliasUser() BEFORE identify() - order matters')
    it('should NOT call alias() if user was already authenticated')
    it('should mark aliased flag in localStorage to prevent duplicate aliasing')
  })

  describe('aliasUser() function', () => {
    it('should retrieve current distinct_id as anonymous_id')
    it('should call mixpanel.alias(userId, anonymousId)')
    it('should call mixpanel.identify(userId) after alias')
    it('should skip if mixpanel_aliased flag is already set')
    it('should set mixpanel_aliased flag after successful alias')
  })

  describe('Edge Cases', () => {
    it('should handle alias() when user registers on different device')
    it('should NOT alias if anonymous_id equals user_id (already identified)')
    it('should log warning if alias fails but not throw')
  })
})
```

**Implementation**: Update `src/infra/analytics/system-events-subscriber.ts`

---

### Phase 4: Event Tracking with Consistent ID

**Test File**: `tests/int/analytics/anonymous-tracking.int.spec.ts`

```typescript
describe('Anonymous User Event Tracking', () => {
  describe('All events should include consistent distinct_id', () => {
    it('PAGE_VIEWED event should use cookie-based anonymous ID')
    it('SESSION_STARTED event should use cookie-based anonymous ID')
    it('COURSE_ENTERED event should use cookie-based anonymous ID')
    it('LESSON_STARTED event should use cookie-based anonymous ID')
    it('PDF_VIEWED event should use cookie-based anonymous ID')
    it('CHAT_MESSAGE_SUBMITTED event should use cookie-based anonymous ID')
  })

  describe('Cross-session persistence', () => {
    it('should use same anonymous ID across browser sessions')
    it('should use same anonymous ID across page refreshes')
    it('should use same anonymous ID across different tabs')
  })

  describe('User state transitions', () => {
    it('should maintain anonymous ID until explicit logout')
    it('should generate new anonymous ID after logout + new session')
  })
})
```

---

### Phase 5: Mixpanel People Profile for Anonymous Users

**Test File**: `tests/int/analytics/anonymous-people.int.spec.ts`

```typescript
describe('Anonymous User Profiles in Mixpanel', () => {
  describe('Profile creation', () => {
    it('should call people.set() on first session with anonymous properties')
    it('should set $created timestamp on first interaction')
    it('should set $browser, $os from user agent')
    it('should set initial_referrer, initial_landing_page')
  })

  describe('Profile updates', () => {
    it('should increment session_count on each SESSION_STARTED')
    it('should update last_seen timestamp on each event')
    it('should NOT overwrite $created on subsequent sessions')
  })
})
```

**Implementation**: Update `src/infra/analytics/adapters/mixpanel/adapter.ts`

---

### Phase 6: Logout / Reset Behavior

**Test File**: `tests/unit/analytics/reset-user.test.ts`

```typescript
describe('User Reset on Logout', () => {
  describe('resetUser() function', () => {
    it('should call mixpanel.reset()')
    it('should clear mixpanel_aliased flag')
    it('should delete mp_anon_id cookie')
    it('should generate new anonymous ID after reset')
  })
})
```

---

### Phase 7: E2E Verification

**Test File**: `tests/e2e/analytics/anonymous-tracking.e2e.spec.ts`

```typescript
describe('Anonymous User Tracking E2E', () => {
  describe('New anonymous visitor flow', () => {
    it('should create mp_anon_id cookie on first page load')
    it('should send page_view event with distinct_id to Mixpanel')
    it('should appear in Mixpanel Users list within 5 minutes')
  })

  describe('Registration conversion flow', () => {
    it('should track all pre-registration events with anonymous ID')
    it('should alias anonymous ID to user ID on registration')
    it('should merge event history after registration')
    it('should allow building funnels from anonymous → registered')
  })

  describe('Cookie persistence', () => {
    it('should persist anonymous ID after browser restart')
    it('should use same ID when returning after 24 hours')
  })

  describe('Logout flow', () => {
    it('should clear mp_anon_id cookie on logout')
    it('should generate new anonymous ID after logout')
    it('should not leak previous anonymous ID to new session')
  })
})
```

---

## Implementation Order

| Order | Component                | Tests First                      | Then Implement                |
| ----- | ------------------------ | -------------------------------- | ----------------------------- |
| 1     | Cookie utilities         | `cookies.test.ts`                | `utils/cookies.ts`            |
| 2     | Anonymous ID utilities   | `anonymous-id.test.ts`           | `utils/anonymous-id.ts`       |
| 3     | Mixpanel init update     | `mixpanel-init.test.ts`          | `scripts.tsx` changes         |
| 4     | Aliasing on registration | `identity-aliasing.int.spec.ts`  | `system-events-subscriber.ts` |
| 5     | People profile tracking  | `anonymous-people.int.spec.ts`   | `adapter.ts` updates          |
| 6     | Logout / reset           | `reset-user.test.ts`             | `adapter.ts` resetUser()      |
| 7     | E2E verification         | `anonymous-tracking.e2e.spec.ts` | Manual Mixpanel verification  |

---

## Files to Create/Modify

| Action     | File Path                                            |
| ---------- | ---------------------------------------------------- |
| **CREATE** | `src/infra/analytics/utils/cookies.ts`               |
| **CREATE** | `src/infra/analytics/utils/anonymous-id.ts`          |
| **CREATE** | `tests/unit/analytics/cookies.test.ts`               |
| **CREATE** | `tests/unit/analytics/anonymous-id.test.ts`          |
| **CREATE** | `tests/unit/analytics/mixpanel-init.test.ts`         |
| **CREATE** | `tests/unit/analytics/reset-user.test.ts`            |
| **CREATE** | `tests/int/analytics/identity-aliasing.int.spec.ts`  |
| **CREATE** | `tests/int/analytics/anonymous-tracking.int.spec.ts` |
| **CREATE** | `tests/int/analytics/anonymous-people.int.spec.ts`   |
| **CREATE** | `tests/e2e/analytics/anonymous-tracking.e2e.spec.ts` |
| **MODIFY** | `src/infra/analytics/adapters/mixpanel/scripts.tsx`  |
| **MODIFY** | `src/infra/analytics/adapters/mixpanel/adapter.ts`   |
| **MODIFY** | `src/infra/analytics/system-events-subscriber.ts`    |

---

## Acceptance Criteria → Test Mapping

| Acceptance Criteria                               | Test Coverage                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Anonymous users appear in Mixpanel user lists     | E2E: "should appear in Mixpanel Users list" + `anonymous-people.int.spec.ts` |
| Events from same anonymous user grouped correctly | Integration: "should use same anonymous ID across sessions"                  |
| Funnels can be built for anonymous users          | E2E: "should allow building funnels from anonymous → registered"             |
| User journey preserved before/after registration  | Integration: aliasing tests + E2E flow                                       |
| Anonymous ID persists across sessions             | E2E: cookie persistence tests + `anonymous-id.test.ts`                       |
| New anonymous ID after logout                     | E2E: "should generate new anonymous ID after logout" + `reset-user.test.ts`  |

---

## Technical Notes

### Cookie vs localStorage Trade-offs

| Aspect             | Cookie                | localStorage         |
| ------------------ | --------------------- | -------------------- |
| Cross-subdomain    | ✅ With proper config | ❌ No                |
| Server-side access | ✅ Yes                | ❌ No                |
| Privacy blockers   | 🟡 Sometimes blocked  | 🟡 Sometimes blocked |
| Size limit         | 4KB                   | 5-10MB               |
| Expiration         | Configurable          | Never                |

**Decision**: Use HTTP cookie for anonymous ID persistence, with localStorage as fallback.

### Mixpanel Identity Model

```
Anonymous User Journey:
┌─────────────────────────────────────────────────────────────┐
│  distinct_id: "anon_abc123"                                 │
│                                                             │
│  Events: page_view → course_entered → lesson_started        │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ alias("user_456", "anon_abc123")
                           │ identify("user_456")
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  distinct_id: "user_456"                                    │
│                                                             │
│  Events: [all previous] + registration_completed + ...      │
│  Profile: email, name, signup_date, etc.                    │
└─────────────────────────────────────────────────────────────┘
```

### Critical: Alias Call Order

```typescript
// ✅ CORRECT ORDER
mixpanel.alias(userId, anonymousId) // Link identities FIRST
mixpanel.identify(userId) // Then switch to new identity

// ❌ WRONG ORDER (breaks history merge)
mixpanel.identify(userId) // Switches identity immediately
mixpanel.alias(userId, anonymousId) // Too late, events already separated
```

### Test Naming Convention

This project uses:

- **Unit tests**: `tests/unit/<feature>/<filename>.test.ts`
- **Integration tests**: `tests/int/<feature>/<filename>.int.spec.ts`
- **E2E tests**: `tests/e2e/<feature>/<filename>.e2e.spec.ts`

Note: The `unit/` directory contains tests that run in Node.js environment without browser. The `int/` directory contains integration tests that may require external services. The `e2e/` directory contains full browser automation tests.
