# Plan: Access Code Gate (Coupon Logic)

## Clarification Adjustments

Based on clarified.md answers:
1. **Multi-use codes** — same code can be used by multiple students
2. **Lesson-only scope** — codes unlock specific lessons only (no course/global scope)
3. **No retained access on deletion** — if code is deactivated/deleted, previously-unlocked students lose access (checked at runtime)
4. **Time expiration** — codes support `expiresAt` date

These simplify the original spec: no `scopeType` enum needed (always lesson), and runtime validation must re-check code validity on each page load.

## Research Findings

- `src/infra/auth/access-types.ts` ✅ — Defines `ACCESS_TYPES`, `LESSON_ACCESS_TYPES`, `resolveAccessType()`
- `src/server/payload/collections/Courses.ts` ✅ — Has `accessType` and `pageAccessType` select fields
- `src/server/payload/collections/Lessons.ts` ✅ — Has `accessType` select field (inherit/free/mandatory/gated)
- `src/server/payload/collections/Users/index.ts` ✅ — Auth collection with roles
- `src/ui/web/auth/AccessGateProvider.tsx` ✅ — Existing gate component, wraps content with blur
- `src/ui/web/auth/AuthGateModal.tsx` ✅ — Existing modal pattern using Dialog
- `src/client/hooks/useAccessGate.ts` ✅ — Client hook for access gate logic
- `src/server/utils/access-gate-server.ts` ✅ — Server-side auth check
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` ✅ — Lesson page using `resolveAccessType()` + `AccessGateProvider`
- `src/server/payload/access/adminOnly.ts` ✅ — Reusable access control
- `src/server/payload/access/authenticated.ts` ✅ — Reusable access control
- `src/server/payload/access/authenticatedOrOwner.ts` ✅ — Pattern for owner-scoped access
- `src/server/payload/fields/createdBy.ts` ✅ — Reusable field
- `src/payload.config.ts` ✅ — Collections array registration
- `src/i18n/en.json` ✅ — Has `accessControl` namespace
- `src/i18n/he.json` ✅ — Has `accessControl` namespace
- `src/app/api/user-settings/route.ts` ✅ — API route pattern reference
- `tests/int/lesson-types.int.spec.ts` ✅ — Integration test pattern
- `src/server/payload/collections/AccessCodes.ts` 🆕 — Will create
- `src/server/payload/collections/CodeRedemptions.ts` 🆕 — Will create
- `src/app/api/access-codes/redeem/route.ts` 🆕 — Will create
- `src/ui/web/auth/AccessCodeGateModal.tsx` 🆕 — Will create
- `src/app/api/access-codes/export/route.ts` 🆕 — Will create

## Reuse Inventory

### Existing Utilities to Reuse
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — access control for AccessCodes and CodeRedemptions collections
- `authenticated` from `src/server/payload/access/authenticated.ts` — access control for redemption endpoint auth check
- `createdByField` from `src/server/payload/fields/createdBy.ts` — track who created access codes
- `tenantField` from `src/server/payload/fields/tenant.ts` — multi-tenant support for access codes
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `src/ui/web/components/dialog` — modal component
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts` — get current user in client components
- `useTranslations` from `src/ui/web/providers/I18n` — i18n translations
- `resolveAccessType()` from `src/infra/auth/access-types.ts` — access type resolution
- `isAuthenticatedServer()` from `src/server/utils/access-gate-server.ts` — server auth check

### New Utilities Justified
- `AccessCodes` collection — new domain entity, nothing similar exists
- `CodeRedemptions` collection — new audit trail, nothing similar exists
- `AccessCodeGateModal` component — existing `AuthGateModal` handles auth login, not code entry; different UX flow
- Redemption API route — unique business logic for code validation and redemption

---

## Steps

### Step 1: Add `accessCode` to Access Types System (FR-001)

**Files to Touch**:
- `src/infra/auth/access-types.ts` (MODIFIED — lines 8-14, 32-45)

**Behavior**:
- Add `'accessCode'` to the `ACCESS_TYPES` constant array
- This automatically propagates to `AccessType` union type
- Add `'accessCode'` option to `LESSON_ACCESS_TYPES` (it inherits from ACCESS_TYPES spread, so automatic)
- Update `resolveAccessType()` — `accessCode` is a valid return type, no special handling needed (it already validates via `ACCESS_TYPES.includes()`)

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/access-types.unit.spec.ts` (NEW)
- Test 1: `ACCESS_TYPES includes 'accessCode'` — verify the new type exists
- Test 2: `resolveAccessType('accessCode', 'free') returns 'accessCode'` — verify lesson-level override works
- Test 3: `resolveAccessType('inherit', 'accessCode') returns 'accessCode'` — verify course inheritance works
- Test 4: Existing types still resolve correctly (regression check)
- Run: `pnpm vitest run tests/unit/access-types.unit.spec.ts`

**Acceptance Criteria**:
- [ ] `AccessType` includes `'accessCode'`
- [ ] `LessonAccessType` includes `'accessCode'`
- [ ] `resolveAccessType()` handles `accessCode` correctly
- [ ] Existing type resolution unchanged

---

### Step 2: Add `accessCode` Option to Lessons Collection (FR-001)

**Files to Touch**:
- `src/server/payload/collections/Courses.ts` (MODIFIED — line ~168 only, NOT pageAccessType)
- `src/server/payload/collections/Lessons.ts` (MODIFIED — lines 157-165)

**Behavior**:
- Add `{ label: 'Access Code Required', value: 'accessCode' }` option to the `accessType` select field in Courses (line ~168) — this is the *default* access type for lessons in the course
- Do **NOT** add `accessCode` to `pageAccessType` in Courses — per clarification #2, access codes are lesson-only; the course page itself should not be gated by access code
- Add `{ label: 'Access Code Required', value: 'accessCode' }` option to the `accessType` select field in Lessons (line ~157)

**Rationale**: The `pageAccessType` controls access to the course page listing chapters/lessons. Gating the course listing page with an access code is not useful — the student needs to see which lessons exist to know what code to enter. The access code gate should only appear when accessing the lesson content itself.

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (NEW)
- Test 1: Create a course with `accessType: 'accessCode'` → succeeds, stored value is `'accessCode'`
- Test 2: Create a lesson with `accessType: 'accessCode'` → succeeds, stored value is `'accessCode'`
- Run: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

**Acceptance Criteria**:
- [ ] Admin can select "Access Code Required" for course default accessType in admin UI
- [ ] Admin can select "Access Code Required" for lesson accessType in admin UI
- [ ] Values persist correctly in database
- [ ] `pageAccessType` on Courses does NOT include `accessCode`

---

### Step 3: Create `AccessCodes` Collection (FR-002)

**Files to Touch**:
- `src/server/payload/collections/AccessCodes.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — add import + register in collections array)

**Behavior**:
Create a new Payload collection with:
- `slug: 'access-codes'`
- Access: `adminOnly` for create/update/delete, `adminOnly` for read (admin-only management)
- Fields:
  - `code`: text, unique, required, index — the code string (e.g., "MACCABI-2024-FREE")
  - `label`: text — admin-friendly name/description
  - `lesson`: relationship to `lessons`, required — the lesson this code unlocks (lesson-only scope per clarification)
  - `maxRedemptions`: number, optional — max uses (0 or null = unlimited)
  - `currentRedemptions`: number, default 0, readOnly — auto-incremented
  - `isActive`: checkbox, default true — admin can deactivate
  - `expiresAt`: date, optional — expiration date (per clarification #4)
  - `createdBy`: reuse `createdByField`
  - `tenant`: reuse `tenantField`
- Admin config:
  - `useAsTitle: 'code'`
  - `defaultColumns: ['code', 'label', 'lesson', 'currentRedemptions', 'maxRedemptions', 'isActive', 'expiresAt']`
  - `group: 'Access Control'` (admin sidebar grouping)

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (append to Step 2's file)
- Test 1: Admin can create access code with all fields → succeeds
- Test 2: Code field is unique → creating duplicate code fails
- Test 3: `currentRedemptions` defaults to 0
- Run: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

**Acceptance Criteria**:
- [ ] `access-codes` collection is visible in admin panel under "Access Control" group
- [ ] Codes are unique
- [ ] Only admins can CRUD codes
- [ ] `createdBy` is auto-populated

---

### Step 4: Create `CodeRedemptions` Collection (FR-004)

**Files to Touch**:
- `src/server/payload/collections/CodeRedemptions.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — add import + register in collections array)

**Behavior**:
Create a new Payload collection for audit trail:
- `slug: 'code-redemptions'`
- Access: `adminOnly` for read/delete, no create/update access (created programmatically only)
- Fields:
  - `accessCode`: relationship to `access-codes`, required, index
  - `user`: relationship to `users`, required, index
  - `lesson`: relationship to `lessons`, required, index — which lesson was unlocked
  - `redeemedAt`: date, required — timestamp of redemption
- Admin config:
  - `useAsTitle: 'redeemedAt'`
  - `defaultColumns: ['user', 'accessCode', 'lesson', 'redeemedAt']`
  - `group: 'Access Control'`
- Timestamps: true

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (append)
- Test 1: Admin can read code redemption records
- Test 2: Redemption includes user, accessCode, lesson, and redeemedAt fields
- Run: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

**Acceptance Criteria**:
- [ ] `code-redemptions` collection exists in admin panel under "Access Control"
- [ ] Shows who redeemed what code for which lesson and when
- [ ] Only admins can view redemption records

---

### Step 5: Create Code Redemption API Endpoint (FR-005)

**Files to Touch**:
- `src/app/api/access-codes/redeem/route.ts` (NEW)

**Behavior**:
`POST /api/access-codes/redeem`

Request body (validated with Zod):
```json
{ "code": "MACCABI-2024-FREE", "lessonId": "abc123" }
```

Validation logic:
1. Auth check via `payload.auth({ headers })` → 401 if not authenticated
2. Zod validate request body → 400 if invalid
3. Find code in `access-codes` where `code equals` + `isActive: true` → 404 if not found
4. Check `expiresAt` — if set and past, return 400 "Code has expired"
5. Check `maxRedemptions` — if set and `currentRedemptions >= maxRedemptions`, return 400 "Code has reached maximum redemptions"
6. Verify code's `lesson` matches the requested `lessonId` → 400 "Code is not valid for this lesson"
7. Check if user already has a redemption for this code+lesson combo → if yes, return 200 with `{ success: true, alreadyRedeemed: true }`
8. Create `code-redemptions` record with `accessCode`, `user`, `lesson`, `redeemedAt: new Date()`
9. Increment `currentRedemptions` on the access code
10. Return 200 `{ success: true }`

All DB operations use `overrideAccess: true` (server-initiated, user already validated).

Response:
- 200: `{ success: true, alreadyRedeemed?: boolean }`
- 400: `{ error: string }` (invalid input, expired, max reached, wrong lesson)
- 401: `{ error: 'Unauthorized' }`
- 404: `{ error: 'Code not found' }`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-redeem.int.spec.ts` (NEW)
- Test 1: Authenticated user with valid code → 200 success, redemption created
- Test 2: Unauthenticated request → 401
- Test 3: Invalid code string → 404
- Test 4: Inactive code → 404
- Test 5: Expired code → 400
- Test 6: Max redemptions reached → 400
- Test 7: Code for wrong lesson → 400
- Test 8: Duplicate redemption → 200 with `alreadyRedeemed: true` (idempotent)
- Test 9: `currentRedemptions` incremented after successful redemption
- Run: `pnpm vitest run tests/int/access-code-redeem.int.spec.ts`

**Acceptance Criteria**:
- [ ] Valid code redemption creates record and increments counter
- [ ] All validation cases return correct error codes
- [ ] Duplicate redemptions are idempotent
- [ ] No access without authentication

---

### Step 6: Create Check-Access API Endpoint

**Files to Touch**:
- `src/app/api/access-codes/check/route.ts` (NEW)

**Behavior**:
`GET /api/access-codes/check?lessonId=abc123`

This endpoint checks whether the current user has an active redemption for a given lesson. Used by the frontend to decide whether to show the code gate modal or the content.

Logic:
1. Auth check → 401 if not authenticated
2. Validate `lessonId` query param → 400 if missing
3. Find redemption in `code-redemptions` where `user equals userId` AND `lesson equals lessonId`
4. If redemption exists, verify the associated access code is still active and not expired:
   - Populate the `accessCode` relationship
   - Check `accessCode.isActive === true` and `expiresAt` not past
5. Return `{ hasAccess: boolean }`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-redeem.int.spec.ts` (append)
- Test 1: User with valid redemption + active code → `{ hasAccess: true }`
- Test 2: User with no redemption → `{ hasAccess: false }`
- Test 3: User with redemption but code deactivated → `{ hasAccess: false }` (clarification #3)
- Test 4: User with redemption but code expired → `{ hasAccess: false }`
- Test 5: Unauthenticated → 401
- Run: `pnpm vitest run tests/int/access-code-redeem.int.spec.ts`

**Acceptance Criteria**:
- [ ] Returns `hasAccess: true` only when redemption exists AND code is still active + not expired
- [ ] Returns `hasAccess: false` when code was deactivated (clarification: no retained access)
- [ ] Unauthenticated requests return 401

---

### Step 7: Add i18n Translation Strings (NFR-001)

**Files to Touch**:
- `src/i18n/en.json` (MODIFIED — add keys inside `accessControl` object)
- `src/i18n/he.json` (MODIFIED — add keys inside `accessControl` object)

**Behavior**:
Add to `accessControl` namespace in both locales:

English (`en.json`):
```json
"accessCodeTitle": "Access Restricted",
"accessCodeDescription": "Please insert your school access code to unlock this content.",
"accessCodePlaceholder": "Enter code",
"accessCodeUnlock": "Unlock",
"accessCodeError": "Incorrect code. Please check with your teacher.",
"accessCodeSuccess": "Content unlocked!",
"accessCodeExpired": "This code has expired.",
"accessCodeMaxReached": "This code has reached its maximum uses.",
"accessCodeLoading": "Verifying..."
```

Hebrew (`he.json`):
```json
"accessCodeTitle": "הגישה מוגבלת",
"accessCodeDescription": "אנא הזן את קוד הגישה של בית הספר שלך כדי לפתוח תוכן זה.",
"accessCodePlaceholder": "הזן קוד",
"accessCodeUnlock": "פתח",
"accessCodeError": "קוד שגוי. אנא בדוק עם המורה שלך.",
"accessCodeSuccess": "התוכן נפתח!",
"accessCodeExpired": "קוד זה פג תוקף.",
"accessCodeMaxReached": "קוד זה הגיע למקסימום השימושים.",
"accessCodeLoading": "מאמת..."
```

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/i18n-access-code.unit.spec.ts` (NEW)
- Test 1: All `accessCode*` keys exist in `en.json` `accessControl` namespace
- Test 2: All `accessCode*` keys exist in `he.json` `accessControl` namespace
- Test 3: Key counts match between en and he for `accessCode*` keys
- Run: `pnpm vitest run tests/unit/i18n-access-code.unit.spec.ts`

**Acceptance Criteria**:
- [ ] All 9 new translation keys exist in both locales
- [ ] English and Hebrew strings are meaningful (not placeholders)

---

### Step 8: Create `AccessCodeGateModal` Component (FR-006)

**Files to Touch**:
- `src/ui/web/auth/AccessCodeGateModal.tsx` (NEW)

**Behavior**:
Client component (`'use client'`) that:
1. Receives props: `isOpen: boolean`, `lessonId: string`, `onSuccess: () => void`
2. Uses `useTranslations('accessControl')` for i18n
3. Renders a `Dialog` (same pattern as `AuthGateModal`)
4. Contains:
   - Title: `t('accessCodeTitle')` — "Access Restricted"
   - Description: `t('accessCodeDescription')`
   - Text input for code entry, placeholder: `t('accessCodePlaceholder')`
   - Submit button: `t('accessCodeUnlock')` — "Unlock"
   - Error message area (shows `t('accessCodeError')` on invalid code)
   - Loading state on submit
5. On submit:
   - POST `/api/access-codes/redeem` with `{ code, lessonId }`
   - If 200 success: call `onSuccess()` callback
   - If error: show appropriate error message
6. Non-dismissible (like `AuthGateModal`, `allowDismiss={false}`)

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (append — integration test, not unit)
- Test: Verify the component file exists and exports `AccessCodeGateModal`
- Note: The project's unit test config uses `environment: 'node'` (no jsdom), so React component rendering tests are not feasible with the current setup. Verify the component through E2E or manual testing. Focus integration tests on the API layer.
- Run: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

**Acceptance Criteria**:
- [ ] Modal shows code input field and unlock button
- [ ] Error messages display correctly for invalid/expired/max-reached codes
- [ ] Modal cannot be dismissed by clicking outside
- [ ] Success triggers content reveal

---

### Step 9: Integrate Access Code Gate into `AccessGateProvider` and Lesson Page (FR-006)

**Files to Touch**:
- `src/ui/web/auth/AccessGateProvider.tsx` (MODIFIED — add accessCode handling)
- `src/client/hooks/useAccessGate.ts` (MODIFIED — add accessCode state)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — pass lessonId to AccessGateProvider)

**Behavior**:

**AccessGateProvider changes**:
- Accept new optional prop: `lessonId?: string` in `AccessGateProviderProps`
- Pass `lessonId` to `useAccessGate()` hook call
- When `accessType === 'accessCode'`:
  - If user is NOT authenticated: show `AuthGateModal` (login first, then enter code)
  - If user IS authenticated: check access via `GET /api/access-codes/check?lessonId=X` (done inside hook)
    - While checking: show loading/blur (use `isCheckingAccess` state)
    - If `hasAccess: true`: show content normally
    - If `hasAccess: false`: show `AccessCodeGateModal` with `lessonId` prop
  - On successful code redemption: hook's `onCodeRedeemed()` updates state, content revealed
- Update `isBlocked` computation: `showMandatoryModal || showGatedModal || showAccessCodeModal`
- Import `AccessCodeGateModal` from `./AccessCodeGateModal`

**useAccessGate hook changes**:
- Add new optional param: `lessonId?: string` to `UseAccessGateParams` interface
- Add new state: `showAccessCodeModal: boolean`
- Add new state: `hasCodeAccess: boolean` (initially false, set to true after check or redemption)
- Add new state: `isCheckingAccess: boolean` (loading state while fetching check endpoint)
- When `accessType === 'accessCode'` and user is authenticated and `lessonId` is provided, fetch `GET /api/access-codes/check?lessonId=X` on mount
- Expose `showAccessCodeModal`, `hasCodeAccess`, `isCheckingAccess`, and `onCodeRedeemed()` callback
- `onCodeRedeemed()` sets `hasCodeAccess = true` and `showAccessCodeModal = false`

**Lesson page changes**:
- Pass `lessonId={lesson.id}` to `AccessGateProvider`
- Server-side: when `effectiveAccessType === 'accessCode'` and user is not authenticated, render minimal content (similar to mandatory mode)

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (append — integration-level tests)
- Note: `useAccessGate` is a client-side React hook. The project's unit test config uses `environment: 'node'` (no jsdom), so direct React hook testing is not feasible. Verify the hook logic through E2E tests or by testing the underlying API endpoints (Steps 5-6) which the hook depends on.
- Integration tests for Step 9 verify: the server-side `accessCode` handling in the lesson page returns correct HTML structure, and the check/redeem API endpoints (already tested in Steps 5-6) support the client-side flow.
- Run: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

**Acceptance Criteria**:
- [ ] Unauthenticated users see login prompt for access-code-gated content
- [ ] Authenticated users without redemption see code entry modal with blur
- [ ] Authenticated users with valid redemption see content normally
- [ ] Content behind modal is blurred/hidden (pointer-events-none)
- [ ] Existing access types (free, mandatory, gated) work unchanged

---

### Step 10: CSV Export Endpoint for Admin (FR-007)

**Files to Touch**:
- `src/app/api/access-codes/export/route.ts` (NEW)

**Behavior**:
`GET /api/access-codes/export?codeId=abc123`

1. Auth check → must be admin (check `user.role === 'admin'`)
2. Validate `codeId` query param
3. Find all `code-redemptions` where `accessCode equals codeId`, populate `user` with depth 1
4. Generate CSV string with columns: `Student Name, Email, Date Redeemed`
5. Return `Response` with:
   - `Content-Type: text/csv`
   - `Content-Disposition: attachment; filename="access-code-redemptions-{code}.csv"`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-export.int.spec.ts` (NEW)
- Test 1: Admin with codeId with redemptions → returns CSV with correct rows
- Test 2: Admin with codeId with no redemptions → returns CSV with header only
- Test 3: Non-admin user → 403
- Test 4: Unauthenticated → 401
- Run: `pnpm vitest run tests/int/access-code-export.int.spec.ts`

**Acceptance Criteria**:
- [ ] CSV contains correct student name, email, and date
- [ ] Only admins can access this endpoint
- [ ] CSV downloads with correct content type and filename

---

### Step 11: Run Type Generation and Quality Gates

**IMPORTANT**: Type generation (`pnpm generate:types`) MUST be run after Steps 3-4 (new collections are created) and BEFORE Steps 8-9 (which import the generated types). The build agent should run `pnpm generate:types` as part of Steps 3 or 4, then again here as a final check.

**Files to Touch**:
- `src/payload-types.ts` (REGENERATED)
- Import map regeneration

**Behavior**:
1. Run `pnpm generate:types` to update TypeScript types for new collections
2. Run `pnpm generate:importmap` if any new admin components
3. Run `pnpm -s tsc --noEmit` to verify no type errors
4. Run `pnpm -s lint` to verify no lint errors
5. Run `pnpm -s format` to verify formatting

**Tests**:
- All prior tests continue to pass
- Run: `pnpm vitest run tests/int/access-code-gate.int.spec.ts tests/int/access-code-redeem.int.spec.ts tests/int/access-code-export.int.spec.ts tests/unit/access-types.unit.spec.ts tests/unit/i18n-access-code.unit.spec.ts`

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] All tests pass
- [ ] No regression in existing tests
