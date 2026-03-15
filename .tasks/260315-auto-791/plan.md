# Implementation Plan: Access Code Gate (Coupon Logic)

**Task ID**: 260315-auto-791
**Spec Requirements**: FR-001 through FR-007, NFR-001, NFR-002

## Rerun Context

This is a rerun (`/cody rerun`). The previous run completed through build but the prev-run artifacts are not available on disk. This plan is rebuilt fresh from spec.md, clarified.md, gap.md, and codebase research. Key simplification from clarified.md: **scope is lesson-only** (no course or global scoping). Students do NOT retain access if code is deleted/deactivated (runtime re-check against CodeRedemptions collection).

## Research Findings

- `src/infra/auth/access-types.ts` ✅ exists — has `ACCESS_TYPES = ['free', 'mandatory', 'gated']`, `LESSON_ACCESS_TYPES = ['inherit', ...ACCESS_TYPES]`, `resolveAccessType()`
- `src/server/payload/collections/Lessons.ts` ✅ exists — `accessType` select field at lines 152-171
- `src/server/payload/collections/Courses.ts` ✅ exists — `accessType` at lines 163-177, `pageAccessType` at lines 147-161
- `src/payload.config.ts` ✅ exists — collections array at lines 143-170
- `src/ui/web/auth/AccessGateProvider.tsx` ✅ exists — wraps content with modals for mandatory/gated
- `src/client/hooks/useAccessGate.ts` ✅ exists — manages access gate state
- `src/ui/web/auth/AuthGateModal.tsx` ✅ exists — non-dismissible Dialog pattern to follow
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` ✅ exists — uses `resolveAccessType()` and `AccessGateProvider`
- `src/server/payload/access/adminOnly.ts` ✅ exists — standard admin access check
- `src/server/payload/access/authenticated.ts` ✅ exists — boolean auth check
- `src/server/payload/access/authenticatedOrOwner.ts` ✅ exists — admin sees all, user sees own
- `src/server/payload/fields/createdBy.ts` ✅ exists — auto-sets `createdBy` on create
- `src/server/payload/fields/tenant.ts` ✅ exists — auto-sets tenant on create
- `src/i18n/en.json` ✅ exists — `accessControl` namespace at lines 314-323
- `src/i18n/he.json` ✅ exists — `accessControl` namespace at lines 314-323
- `src/app/api/user-settings/route.ts` ✅ exists — API route pattern (auth check, Zod, Payload queries)
- `tests/int/lesson-types.int.spec.ts` ✅ exists — integration test pattern (ensureDefaultTenant helper)
- `src/server/payload/collections/AccessCodes.ts` 🆕 will create
- `src/server/payload/collections/CodeRedemptions.ts` 🆕 will create
- `src/app/api/access-codes/redeem/route.ts` 🆕 will create
- `src/app/api/access-codes/check/route.ts` 🆕 will create
- `src/app/api/access-codes/export/route.ts` 🆕 will create
- `src/ui/web/auth/AccessCodeGateModal.tsx` 🆕 will create

### Patterns Observed
- Collections use `adminOnly` access control from `src/server/payload/access/adminOnly.ts`
- Tenant-scoped collections use `tenantField` from `src/server/payload/fields/tenant.ts`
- `createdByField` auto-sets the creating user's ID
- API routes use `payload.auth({ headers: req.headers })` for authentication
- Integration tests use `getPayload({ config })` and `ensureDefaultTenant()` pattern
- AccessGateProvider wraps content with blur effect when blocked
- AuthGateModal uses `Dialog` with `allowDismiss={false}` for non-dismissible modals

### Integration Points
- Must register AccessCodes + CodeRedemptions in `payload.config.ts` collections array
- Must run `pnpm generate:types` after adding new collections
- Must run `pnpm generate:importmap` after adding new admin components
- Lesson page uses `resolveAccessType()` — must handle `accessCode` return value
- AccessGateProvider receives `accessType` — must handle `accessCode` case
- Translation strings go in `accessControl` namespace in both `en.json` and `he.json`

## Reuse Inventory

### Existing utilities the plan will reuse (with import paths)
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — CRUD access on AccessCodes
- `authenticated` from `src/server/payload/access/authenticated.ts` — auth check pattern
- `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts` — CodeRedemptions read (admin sees all, user sees own)
- `createdByField` from `src/server/payload/fields/createdBy.ts` — AccessCodes `createdBy` field
- `tenantField` from `src/server/payload/fields/tenant.ts` — AccessCodes tenant scoping
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from `src/ui/web/components/dialog` — AccessCodeGateModal UI
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts` — user state in access code flow
- `useTranslations` from `src/ui/web/providers/I18n` — i18n strings
- `AccountRole` from `src/server/payload/collections/Users/roles.ts` — admin role checks
- `isUsersCollectionUser` from `src/server/payload/access/isUsersCollectionUser.ts` — safe user type
- `getDefaultTenantSlug` from `src/server/repos/tenant/get-default-tenant` — integration tests

### Justification for NEW utilities
- `AccessCodes` collection — no existing collection serves this purpose
- `CodeRedemptions` collection — no existing audit trail collection for code usage
- `AccessCodeGateModal` component — no existing code-entry modal; AuthGateModal is for login, not code input
- API routes for redeem/check/export — no existing endpoints handle access code logic

---

## Steps

### Step 1: Add `accessCode` to Access Types (FR-001)

**Files to Touch**:
- `src/infra/auth/access-types.ts` (MODIFIED — lines 8-14, 32-44)

**Behavior**:
- Add `'accessCode'` to `ACCESS_TYPES` array: `['free', 'mandatory', 'gated', 'accessCode']`
- `AccessType` union type will automatically include `'accessCode'`
- Add `'accessCode'` to `LESSON_ACCESS_TYPES`: `['inherit', ...ACCESS_TYPES]` (automatic via spread)
- Update `resolveAccessType()` — `'accessCode'` is already a valid `ACCESS_TYPES` member so existing logic will handle it correctly (returns lesson-level if set, otherwise falls back to course-level)

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/access-types.unit.spec.ts`
- Test 1: `ACCESS_TYPES includes 'accessCode'`
- Test 2: `LESSON_ACCESS_TYPES includes 'accessCode'`
- Test 3: `resolveAccessType('accessCode', 'free') returns 'accessCode'`
- Test 4: `resolveAccessType('inherit', 'accessCode') returns 'accessCode'`
- Test 5: `resolveAccessType('accessCode', 'gated') returns 'accessCode'` (lesson overrides course)

**Acceptance Criteria**:
- [ ] `'accessCode'` is in `ACCESS_TYPES`
- [ ] `resolveAccessType` correctly resolves `accessCode` from lesson or course level
- [ ] Existing access types (`free`, `mandatory`, `gated`, `inherit`) behavior unchanged
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes

**Run**: `pnpm vitest run tests/unit/access-types.unit.spec.ts`

---

### Step 2: Add i18n Translation Strings (NFR-001)

**Files to Touch**:
- `src/i18n/en.json` (MODIFIED — add keys inside `accessControl` object at line ~323)
- `src/i18n/he.json` (MODIFIED — add keys inside `accessControl` object at line ~323)

**Behavior**:
Add the following keys to the `accessControl` namespace in both files:

English (`en.json`):
```json
"accessCodeTitle": "Access Restricted",
"accessCodeDescription": "Please insert your school access code to unlock this content.",
"accessCodePlaceholder": "Enter code",
"accessCodeUnlock": "Unlock",
"accessCodeError": "Incorrect code. Please check with your teacher.",
"accessCodeSuccess": "Content unlocked!",
"accessCodeLoading": "Verifying..."
```

Hebrew (`he.json`):
```json
"accessCodeTitle": "גישה מוגבלת",
"accessCodeDescription": "הכנס את קוד הגישה של בית הספר שלך כדי לפתוח תוכן זה.",
"accessCodePlaceholder": "הכנס קוד",
"accessCodeUnlock": "פתח גישה",
"accessCodeError": "קוד שגוי. אנא בדוק עם המורה שלך.",
"accessCodeSuccess": "התוכן נפתח!",
"accessCodeLoading": "מאמת..."
```

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/i18n-access-code.unit.spec.ts`
- Test 1: `en.json accessControl has all accessCode keys`
- Test 2: `he.json accessControl has all accessCode keys`
- Test 3: `en.json and he.json have identical accessCode key sets`

**Acceptance Criteria**:
- [ ] All 7 accessCode keys present in `en.json` `accessControl` namespace
- [ ] All 7 accessCode keys present in `he.json` `accessControl` namespace
- [ ] Key sets match between en and he

**Run**: `pnpm vitest run tests/unit/i18n-access-code.unit.spec.ts`

---

### Step 3: Create AccessCodes Collection (FR-002)

**Files to Touch**:
- `src/server/payload/collections/AccessCodes.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — add import + register in collections array)

**Behavior**:
Create a Payload collection with slug `access-codes` and these fields:
- `code`: text, required, unique, index — the code string (e.g., "MACCABI-2024-FREE")
- `lesson`: relationship to `lessons`, required — the specific lesson this code unlocks (lesson-only scope per clarified.md)
- `maxRedemptions`: number, optional, min 1 — max uses allowed (null = unlimited)
- `currentRedemptions`: number, defaultValue 0, admin readOnly — auto-incremented on use
- `isActive`: checkbox, defaultValue true — whether code is currently valid
- `expiresAt`: date, optional — expiration date (per clarified.md #4)
- `tenantField` — reuse existing tenant field
- `createdByField` — reuse existing createdBy field

Access control:
- `create`: `adminOnly`
- `read`: `adminOnly`
- `update`: `adminOnly`
- `delete`: `adminOnly`

Admin config:
- `useAsTitle: 'code'`
- `defaultColumns: ['code', 'lesson', 'currentRedemptions', 'maxRedemptions', 'isActive', 'expiresAt']`

Register in `payload.config.ts` collections array.

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts`
- Test 1: `can create an access code with all required fields`
- Test 2: `code field is unique` (duplicate code → error)
- Test 3: `defaults: isActive=true, currentRedemptions=0`
- Test 4: `expiresAt field is optional`

**Acceptance Criteria**:
- [ ] `access-codes` collection registered and functional
- [ ] Admin-only CRUD enforced
- [ ] Unique constraint on `code` field
- [ ] `tenantField` and `createdByField` work correctly
- [ ] `pnpm generate:types` succeeds after this step

**Run**: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

---

### Step 4: Create CodeRedemptions Collection (FR-004)

**Files to Touch**:
- `src/server/payload/collections/CodeRedemptions.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — add import + register)

**Behavior**:
Create a Payload collection with slug `code-redemptions` and these fields:
- `code`: relationship to `access-codes`, required, index — which code was used
- `user`: relationship to `users`, required, index — who redeemed it
- `lesson`: relationship to `lessons`, required, index — which lesson was unlocked
- `redeemedAt`: date, required, defaultValue `new Date()` via beforeChange hook

Access control:
- `create`: `adminOnly` (only server-side code creates redemptions)
- `read`: `authenticatedOrOwner` (admin sees all, user sees own via `user` field match)
- `update`: admin-only (or disallow entirely — records are immutable)
- `delete`: `adminOnly`

Admin config:
- `useAsTitle: 'redeemedAt'`
- `defaultColumns: ['code', 'user', 'lesson', 'redeemedAt']`

Register in `payload.config.ts` collections array.

**NOTE**: Run `pnpm generate:types` after Steps 3+4 to regenerate payload-types.ts.

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (same file, new describe block)
- Test 5: `can create a code redemption record`
- Test 6: `redemption links code, user, and lesson`

**Acceptance Criteria**:
- [ ] `code-redemptions` collection registered and functional
- [ ] Admin can read all records; user reads only own (via `authenticatedOrOwner`)
- [ ] Immutable records (update restricted to admin)
- [ ] `pnpm generate:types` succeeds

**Run**: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

---

### Step 5: Add `accessCode` Option to Lessons and Courses Select Fields (FR-001)

**Files to Touch**:
- `src/server/payload/collections/Lessons.ts` (MODIFIED — lines 152-165, add option to `accessType` select)
- `src/server/payload/collections/Courses.ts` (MODIFIED — lines 163-177 `accessType`, lines 147-161 `pageAccessType`)

**Behavior**:
Add `{ label: 'Access Code Required', value: 'accessCode' }` option to:
- `Lessons.ts` → `accessType` select field (alongside inherit, free, mandatory, gated)
- `Courses.ts` → `accessType` select field (alongside free, mandatory, gated)
- `Courses.ts` → `pageAccessType` select field (alongside free, mandatory, gated)

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-gate.int.spec.ts` (new describe block)
- Test 7: `can create a lesson with accessType='accessCode'`
- Test 8: `can create a course with accessType='accessCode'`
- Test 9: `resolveAccessType returns 'accessCode' for lesson with accessType='accessCode'`

**Acceptance Criteria**:
- [ ] Lesson can be saved with `accessType: 'accessCode'`
- [ ] Course can be saved with `accessType: 'accessCode'`
- [ ] Existing access types still work
- [ ] TypeScript compiles

**Run**: `pnpm vitest run tests/int/access-code-gate.int.spec.ts`

---

### Step 6: Create Code Redemption API Endpoint (FR-005)

**Files to Touch**:
- `src/app/api/access-codes/redeem/route.ts` (NEW)

**Behavior**:
`POST /api/access-codes/redeem`

Request body (validated with Zod):
```typescript
{ code: string, lessonId: string }
```

Response:
```typescript
{ success: boolean, message: string }
```

Validation logic:
1. Authenticate user via `payload.auth({ headers: req.headers })`
2. Parse/validate body with Zod schema
3. Find code in `access-codes` collection where `code` matches AND `lesson` equals `lessonId`
4. Verify `isActive === true`
5. Verify not expired (`expiresAt` is null or in the future)
6. Verify `maxRedemptions` not reached (`currentRedemptions < maxRedemptions` or `maxRedemptions` is null)
7. Check user hasn't already redeemed (query `code-redemptions` for same `code` + `user` + `lesson`)
8. If already redeemed → return `{ success: true, message: 'Already redeemed' }` (idempotent)
9. Increment `currentRedemptions` on the access code
10. Create `code-redemptions` record
11. Return `{ success: true, message: 'Content unlocked' }`

Error responses:
- 401 if not authenticated
- 400 if body invalid
- 404 if code not found or not valid for this lesson
- 409 if max redemptions reached
- 500 for unexpected errors

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-redeem.int.spec.ts`
- Test 1: `returns 401 when not authenticated`
- Test 2: `returns 400 for invalid body (missing code)`
- Test 3: `returns 404 for nonexistent code`
- Test 4: `successfully redeems a valid code`
- Test 5: `increments currentRedemptions after redemption`
- Test 6: `creates code-redemptions record`
- Test 7: `returns success for already-redeemed code (idempotent)`
- Test 8: `returns 404 for inactive code`
- Test 9: `returns 404 for expired code`
- Test 10: `returns 409 when maxRedemptions reached`
- Test 11: `code for lesson A does not unlock lesson B`

**Acceptance Criteria**:
- [ ] Valid code + authenticated user → creates redemption, returns success
- [ ] Duplicate redemption → idempotent success (no duplicate record)
- [ ] Invalid/inactive/expired code → appropriate error
- [ ] Max redemptions enforced
- [ ] Lesson scope enforced (code must target the specific lesson)

**Run**: `pnpm vitest run tests/int/access-code-redeem.int.spec.ts`

---

### Step 7: Create Access Code Check API Endpoint (FR-005 supplement)

**Files to Touch**:
- `src/app/api/access-codes/check/route.ts` (NEW)

**Behavior**:
`GET /api/access-codes/check?lessonId=<id>`

This endpoint checks if the current authenticated user has an active redemption for a specific lesson. This is the **runtime re-check** that ensures access is revoked when a code is deleted/deactivated (clarified.md #3).

Response:
```typescript
{ hasAccess: boolean }
```

Logic:
1. Authenticate user
2. Find any `code-redemptions` record for this `user` + `lesson`
3. For each redemption, verify the linked `access-codes` record is still `isActive` and not expired
4. If at least one valid redemption exists → `{ hasAccess: true }`
5. Otherwise → `{ hasAccess: false }`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-redeem.int.spec.ts` (new describe block)
- Test 12: `returns hasAccess=false when no redemption exists`
- Test 13: `returns hasAccess=true after valid redemption`
- Test 14: `returns hasAccess=false after code is deactivated`
- Test 15: `returns 401 when not authenticated`

**Acceptance Criteria**:
- [ ] Returns true when user has active redemption with active code
- [ ] Returns false when code has been deactivated (runtime re-check)
- [ ] Returns false when code has expired
- [ ] Returns 401 for unauthenticated requests

**Run**: `pnpm vitest run tests/int/access-code-redeem.int.spec.ts`

---

### Step 8: Create Admin CSV Export Endpoint (FR-007)

**Files to Touch**:
- `src/app/api/access-codes/export/route.ts` (NEW)

**Behavior**:
`GET /api/access-codes/export?codeId=<accessCodeId>`

- Admin-only endpoint
- Fetches all `code-redemptions` where `code` equals `codeId`
- Populates `user` relationship (depth 1) to get name and email
- Generates CSV with columns: `Student Name, Email, Date Redeemed`
- Returns CSV file with `Content-Type: text/csv` and `Content-Disposition: attachment; filename=...`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/access-code-export.int.spec.ts`
- Test 1: `returns 401 for unauthenticated request`
- Test 2: `returns 403 for non-admin user`
- Test 3: `returns CSV with correct headers`
- Test 4: `CSV contains redemption data with student name and email`
- Test 5: `returns empty CSV (headers only) when no redemptions`

**Acceptance Criteria**:
- [ ] Admin-only access enforced
- [ ] CSV has correct format with Student Name, Email, Date Redeemed columns
- [ ] Response has correct Content-Type and Content-Disposition headers
- [ ] Handles empty data gracefully

**Run**: `pnpm vitest run tests/int/access-code-export.int.spec.ts`

---

### Step 9: Create AccessCodeGateModal Component (FR-006)

**Files to Touch**:
- `src/ui/web/auth/AccessCodeGateModal.tsx` (NEW)

**Behavior**:
Client component (`'use client'`) that renders a non-dismissible Dialog modal for code entry.

Props:
```typescript
interface AccessCodeGateModalProps {
  isOpen: boolean
  lessonId: string
  onSuccess: () => void
}
```

Implementation:
- Uses `Dialog` from `src/ui/web/components/dialog` with `allowDismiss={false}`
- Uses `useTranslations('accessControl')` for all strings
- Text input for code entry
- "Unlock" button that calls `POST /api/access-codes/redeem`
- Loading state while API call in progress
- Error state shows `accessCodeError` translation
- On success: calls `onSuccess()` callback
- Follows `AuthGateModal` pattern (Dialog, DialogContent, DialogHeader, etc.)

**Tests**:
- No unit tests for React components (jsdom not configured in this project)
- Component will be tested via integration in Step 10 and E2E tests

**Acceptance Criteria**:
- [ ] Component renders Dialog with code input and unlock button
- [ ] Uses i18n translations (not hardcoded strings)
- [ ] Calls redeem API on submit
- [ ] Shows error on failure, calls onSuccess on success
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

### Step 10: Integrate AccessCodeGate into AccessGateProvider and Lesson Page (FR-001, FR-006)

**Files to Touch**:
- `src/client/hooks/useAccessGate.ts` (MODIFIED — add accessCode state)
- `src/ui/web/auth/AccessGateProvider.tsx` (MODIFIED — add AccessCodeGateModal rendering)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — pass `lessonId` to AccessGateProvider)

**Behavior**:

**useAccessGate.ts changes**:
- Add `isAccessCode` check: `accessType === 'accessCode'`
- Add `showAccessCodeModal` state (boolean)
- Add `accessCodeUnlocked` state (boolean, initially false)
- On mount when `isAccessCode`: call `GET /api/access-codes/check?lessonId=...` to check existing redemption
- If check returns `hasAccess: true` → set `accessCodeUnlocked = true`, don't show modal
- If check returns `hasAccess: false` → set `showAccessCodeModal = true`
- Add `onAccessCodeSuccess` callback that sets `accessCodeUnlocked = true` and `showAccessCodeModal = false`
- Return `showAccessCodeModal` and `onAccessCodeSuccess` from hook
- **New prop needed**: `lessonId?: string` (only needed for accessCode type)

**AccessGateProvider.tsx changes**:
- Accept new prop `lessonId?: string`
- Destructure `showAccessCodeModal` and `onAccessCodeSuccess` from `useAccessGate`
- Render `<AccessCodeGateModal>` when `showAccessCodeModal` is true
- Add `accessCode` to `isBlocked` check: `isBlocked = showMandatoryModal || showGatedModal || showAccessCodeModal`

**Lesson page.tsx changes**:
- Pass `lessonId={lesson.id}` to all `<AccessGateProvider>` instances
- For `accessCode` type: server-side should NOT block (unlike `mandatory`), because the client needs to render the code entry modal

**Tests**:
- No unit tests for hooks/components (jsdom not configured)
- Acceptance via TypeScript compilation and manual verification
- E2E test would be ideal but deferred to e2e-test-writer

**Acceptance Criteria**:
- [ ] When lesson has `accessType: 'accessCode'` and user has no redemption → shows AccessCodeGateModal, content is blurred
- [ ] When user enters valid code → modal closes, content is revealed
- [ ] When user already redeemed → modal doesn't show (runtime check)
- [ ] When code is later deactivated → on next visit, modal shows again (no retained access)
- [ ] Existing `mandatory` and `gated` flows unchanged
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

---

### Step 11: Quality Gates and Type Generation

**Files to Touch**: None (commands only)

**Behavior**:
Run all quality checks to ensure nothing is broken:

1. `pnpm generate:types` — regenerate payload types with new collections
2. `pnpm generate:importmap` — regenerate admin import map
3. `pnpm tsc --noEmit` — TypeScript check
4. `pnpm lint` — lint check
5. `pnpm vitest run tests/unit/access-types.unit.spec.ts tests/unit/i18n-access-code.unit.spec.ts tests/int/access-code-gate.int.spec.ts tests/int/access-code-redeem.int.spec.ts tests/int/access-code-export.int.spec.ts` — all tests pass

**Acceptance Criteria**:
- [ ] `pnpm generate:types` succeeds
- [ ] `pnpm tsc --noEmit` passes with no errors
- [ ] `pnpm lint` passes
- [ ] All 5 test files pass
- [ ] No regressions in existing tests

**Run**: Commands listed above

---

## Ordering & Dependencies

```
Step 1 (access-types.ts) ─────────────────────────────┐
Step 2 (i18n strings) ─────────────────────────────────┤
                                                        ├── Step 5 (Lessons/Courses field options)
Step 3 (AccessCodes collection) ───┐                    │
                                    ├── generate:types ──┤
Step 4 (CodeRedemptions collection)┘                    │
                                                        ├── Step 6 (redeem API)
                                                        ├── Step 7 (check API)
                                                        ├── Step 8 (export API)
                                                        ├── Step 9 (AccessCodeGateModal)
                                                        └── Step 10 (integration)
                                                              │
                                                              └── Step 11 (quality gates)
```

**Critical ordering note**: `pnpm generate:types` MUST run after Steps 3-4 (new collections) and before Steps 6-10 (which import from `@/payload-types`).
