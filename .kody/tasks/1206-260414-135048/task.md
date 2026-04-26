# fix: Restrict all learning features to registered users only

## Description

Unregistered users can access course content and all learning features without being prompted to register. The system should require registration immediately when an unregistered user attempts to access any learning route.

## Scope

**Public (no login required):**
- `/` (landing page)
- `/courses` (catalog listing only)

**Requires registration (redirect to `/login`):**
- `/courses/[slug]` (individual course pages)
- `/courses/.../lessons/...` (all lesson routes)
- `/study`
- `/practice`
- `/test`
- `/ask`

## Steps to Reproduce

1. Open a private/incognito browser window
2. Navigate to `/study`, `/practice`, `/test`, or `/ask`
3. User gains full access without any registration prompt

## Expected Behavior

Anonymous users are redirected to `/login` when accessing any protected learning route. After login/signup, they are redirected back to the page they were trying to access.

## Plan

### Step 1: Write integration test for auth middleware

**File:** `tests/int/auth-middleware.int.spec.ts`
**Change:** Create test that verifies:
- Anonymous requests to `/study`, `/practice`, `/test`, `/ask`, `/courses/math/chapters/...` redirect to `/login`
- Anonymous requests to `/`, `/courses` (catalog) pass through
- Authenticated requests to all routes pass through
**Why:** TDD — define expected behavior before implementation
**Verify:** `pnpm exec vitest run tests/int/auth-middleware.int.spec.ts --config ./vitest.config.mts` (should fail — RED)

### Step 2: Add auth guard logic to existing middleware

**File:** `middleware.ts`
**Change:** After the existing locale logic, add a route matcher for protected paths (`/study`, `/practice`, `/test`, `/ask`, `/courses/[slug]/...` but NOT `/courses` exactly). Check for the Payload JWT cookie — if absent, redirect to `/login` with a `returnTo` query param preserving the original URL.
**Why:** Single enforcement point — every request passes through middleware, no per-page auth checks to forget
**Verify:** `pnpm tsc --noEmit` + run the integration test (should pass — GREEN)

### Step 3: Update login page to handle `returnTo` redirect

**File:** `src/app/(frontend)/login/page.tsx` (and/or login client component)
**Change:** Read `returnTo` from search params. After successful login, redirect to `returnTo` instead of `/`. Validate that `returnTo` is a relative path (no open redirect vulnerability).
**Why:** UX — user lands back where they were trying to go after logging in
**Verify:** Manual verification + ensure typecheck passes

### Step 4: Update signup page similarly

**File:** `src/app/(frontend)/signup/page.tsx` (and/or signup client component)
**Change:** Same `returnTo` handling as login
**Why:** Consistency — signup should also redirect back
**Verify:** `pnpm tsc --noEmit`

### Step 5: Run full quality gates

**Verify:** `pnpm ci:local`

---

## Discussion (17 comments)

**@yaeliavni** (2026-04-14):
@kody

**@aguyaharonyair** (2026-04-14):
@kody

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `1206-260414-115854`

**@aguyaharonyair** (2026-04-14):
## Pipeline Summary: `1206-260414-115854`

| Stage | Status | Duration | Retries |
|-------|--------|----------|---------|
| taskify | failed | - | 1 |
| plan | pending | - | 0 |
| build | pending | - | 0 |
| verify | pending | - | 0 |
| review | pending | - | 0 |
| review-fix | pending | - | 0 |
| ship | pending | - | 0 |

**Total:** 0s | **Model:** MiniMax-M2.7-highspeed

**@aguyaharonyair** (2026-04-14):
❌ Pipeline failed at **taskify**: Exit code 1
Error: Session ID f68a5161-9772-4e0d-8eda-bc96b7d02813 is already in use.


**@aguyaharonyair** (2026-04-14):
@kody test session fix

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `test`

**@aguyaharonyair** (2026-04-14):
## Pipeline Summary: `test`

| Stage | Status | Duration | Retries |
|-------|--------|----------|---------|
| taskify | failed | - | 1 |
| plan | pending | - | 0 |
| build | pending | - | 0 |
| verify | pending | - | 0 |
| review | pending | - | 0 |
| review-fix | pending | - | 0 |
| ship | pending | - | 0 |

**Total:** 0s | **Model:** MiniMax-M2.7-highspeed

**@aguyaharonyair** (2026-04-14):
❌ Pipeline failed at **taskify**: Exit code 1
Error: Session ID ae8f1e5f-d3a9-4399-9cc3-dcd401085da3 is already in use.


**@aguyaharonyair** (2026-04-14):
@kody test v0.1.116

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `test`

**@aguyaharonyair** (2026-04-14):
## Pipeline Summary: `test`

| Stage | Status | Duration | Retries |
|-------|--------|----------|---------|
| taskify | timeout | - | 1 |
| plan | pending | - | 0 |
| build | pending | - | 0 |
| verify | pending | - | 0 |
| review | pending | - | 0 |
| review-fix | pending | - | 0 |
| ship | pending | - | 0 |

**Total:** 0s | **Model:** MiniMax-M2.7-highspeed

**@aguyaharonyair** (2026-04-14):
❌ Pipeline failed at **taskify**: Stage timed out

**@aguyaharonyair** (2026-04-14):
@kody

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `1206-260414-134521`

**@aguyaharonyair** (2026-04-14):
@kody

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `1206-260414-135048`

