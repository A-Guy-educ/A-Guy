# Plan: Access Code Gate (Coupon Logic)

## Rerun Context

This is a rerun requested via `/cody rerun`. No previous plan/build/review artifacts exist. This is a fresh plan based on the spec + clarified answers.

**Clarified answers applied**:
1. Same code for multiple students → Multi-use codes (one code, many students)
2. Lesson only → Scope is limited to individual lessons (not course-level or global)
3. No → If code is deleted, students who redeemed do NOT retain access
4. Yes → Codes can have time-based expiration

**Spec Deviations (per clarified answers):**
- **FR-002 scope narrowed**: Spec says `scopeType` MUST support `lesson`, `course`, `global`. Per clarified answer #2, this plan implements `lesson` scope only. The `scopeType` field is extensible for future course/global support.
- **FR-003 replaced by FR-004**: Spec says MUST add `redeemedAccessCodes` array to Users. This plan uses the `code-redemptions` collection (FR-004) + a check endpoint instead, avoiding unbounded arrays on User documents. Same persistence guarantee, better data architecture.

## Research Findings

**File paths verified:**
- ✅ `src/infra/auth/access-types.ts` — Current access types: `free`, `mandatory`, `gated`
- ✅ `src/server/constants/access-types.ts` — Re-exports from infra/auth
- ✅ `src/server/payload/collections/Users/index.ts` — Users collection, no redeemed codes field
- ✅ `src/server/payload/collections/Lessons.ts` — Lessons with `accessType` field (line 153-171)
- ✅ `src/server/payload/collections/Courses.ts` — Courses with `accessType` field (line 162-177)
- ✅ `src/payload.config.ts` — Collections array registration (line 143-170)
- ✅ `src/ui/web/auth/AccessGateProvider.tsx` — Existing gate provider (handles gated/mandatory)
- ✅ `src/ui/web/auth/AuthGateModal.tsx` — Existing modal pattern (Dialog + blur)
- ✅ `src/client/hooks/useAccessGate.ts` — Access gate hook logic
- ✅ `src/server/payload/access/adminOnly.ts` — Admin access control
- ✅ `src/server/payload/access/authenticated.ts` — Authenticated access control
- ✅ `src/server/payload/access/authenticatedOrOwner.ts` — User-scoped access with admin override
- ✅ `src/server/payload/fields/createdBy.ts` — Reusable createdBy field
- ✅ `src/i18n/en.json` — English translations (accessControl section at line 314)
- ✅ `src/i18n/he.json` — Hebrew translations (accessControl section at line 314)
- ✅ `src/app/api/user-settings/route.ts` — API route pattern reference
- 🆕 `src/server/payload/collections/AccessCodes.ts` — Will create
- 🆕 `src/server/payload/collections/CodeRedemptions.ts` — Will create
- 🆕 `src/app/api/access-codes/redeem/route.ts` — Will create
- 🆕 `src/ui/web/auth/AccessCodeGateModal.tsx` — Will create
- 🆕 `src/app/api/access-codes/export/route.ts` — Will create
- 🆕 `tests/int/access-codes.int.spec.ts` — Will create
- 🆕 `tests/unit/access-types.test.ts` — Will create
- 🆕 `tests/unit/i18n-access-code-keys.test.ts` — Will create
- 🆕 `tests/unit/components/AccessCodeGateModal.test.tsx` — Will create
- 🆕 `tests/unit/components/AccessGateProvider-accessCode.test.tsx` — Will create
- 🆕 `src/app/api/access-codes/check/route.ts` — Will create

**Patterns observed:**
- Collections use `adminOnly` from `src/server/payload/access/adminOnly.ts` for CUD operations
- User-scoped data uses `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts`
- `createdByField` from `src/server/payload/fields/createdBy.ts` auto-sets on create
- API routes use `payload.auth({ headers: req.headers })` for authentication
- API routes validate input with Zod schemas
- Frontend modals use Dialog component from `@/ui/web/components/dialog`
- Translations live in `src/i18n/en.json` and `src/i18n/he.json`
- AccessGateProvider wraps content and shows blur + modal when blocked
- Lesson pages resolve access type via `resolveAccessType(lesson.accessType, course.accessType)`

**Integration points:**
- New collections must be registered in `src/payload.config.ts` collections array
- `resolveAccessType` in `src/infra/auth/access-types.ts` must handle `accessCode` type
- `AccessGateProvider` in `src/ui/web/auth/AccessGateProvider.tsx` must handle `accessCode` case
- Lesson page `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` passes access type to gate

## Reuse Inventory

**Existing utilities/functions to reuse:**
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — For collection CUD access
- `authenticated` from `src/server/payload/access/authenticated.ts` — For redemption create access
- `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts` — Pattern for code-redemptions read
- `createdByField` from `src/server/payload/fields/createdBy.ts` — Auto-set created_by on access codes
- `tenantField` from `src/server/payload/fields/tenant.ts` — Tenant association
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from `src/ui/web/components/dialog` — Modal UI
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts` — Get current user in client
- `useTranslations` from `src/ui/web/providers/I18n` — Translation hook
- `resolveAccessType` from `src/infra/auth/access-types.ts` — Must be extended, not replaced

**Justification for NEW code:**
- New `AccessCodes` collection — No existing collection for coupon/access-code management
- New `CodeRedemptions` collection — No existing audit trail collection for tracking redemptions
- New `AccessCodeGateModal` component — Existing `AuthGateModal` is for login-based gates (shows Google login), not code entry
- New `/api/access-codes/redeem` endpoint — No existing redemption/validation logic
- New `/api/access-codes/export` endpoint — No existing CSV export functionality

---

## Step 1: Add `accessCode` Access Type (FR-001)

**Files to Touch:**
- `src/infra/auth/access-types.ts` (MODIFIED — lines 8-14, 32-44)

**Behavior:**
- Add `'accessCode'` to `ACCESS_TYPES` array → `['free', 'mandatory', 'gated', 'accessCode'] as const`
- Add `'accessCode'` to `LESSON_ACCESS_TYPES` → `['inherit', ...ACCESS_TYPES] as const` (auto-included)
- Update `resolveAccessType()` to handle `accessCode` as a valid access type (already covered since it checks `ACCESS_TYPES.includes()`)

**Tests (FAIL before, PASS after):**
- Test file: `tests/unit/access-types.test.ts` (NEW)
- Test 1: `ACCESS_TYPES includes 'accessCode'` — Verify the constant includes the new type
- Test 2: `resolveAccessType('accessCode', 'free') returns 'accessCode'` — Verify resolution
- Test 3: `resolveAccessType('inherit', 'accessCode') returns 'accessCode'` — Verify course-level inheritance
- Run: `pnpm test:unit tests/unit/access-types.test.ts`

**Acceptance Criteria:**
- [ ] `AccessType` type includes `'accessCode'`
- [ ] `LessonAccessType` type includes `'accessCode'`
- [ ] `resolveAccessType` correctly resolves `accessCode` type
- [ ] No breaking changes to existing types

---

## Step 2: Add `accessCode` Option to Lessons Collection (FR-001)

**Files to Touch:**
- `src/server/payload/collections/Lessons.ts` (MODIFIED — line 157, add option)
- `src/server/payload/collections/Courses.ts` (MODIFIED — line 167, add option to `accessType`)

**Behavior:**
- Add `{ label: 'Access Code Required', value: 'accessCode' }` to the `accessType` field options in Lessons (after the gated option, line ~165)
- Add `{ label: 'Access Code Required', value: 'accessCode' }` to the `accessType` field options in Courses (line ~170)
- Add the same to `pageAccessType` field in Courses (line ~154) — not needed per clarified scope (lesson only), but keep for future flexibility

**Tests (FAIL before, PASS after):**
- Test file: `tests/int/access-codes.int.spec.ts` (NEW)
- Test 1: `Creating a lesson with accessType='accessCode' succeeds` — Create lesson via Local API
- Test 2: `Creating a course with accessType='accessCode' succeeds` — Create course via Local API
- Run: `pnpm test:int tests/int/access-codes.int.spec.ts`

**Acceptance Criteria:**
- [ ] Lessons can have `accessType: 'accessCode'`
- [ ] Courses can have `accessType: 'accessCode'`
- [ ] Existing access types still work

---

## Step 3: Create AccessCodes Collection (FR-002)

**Files to Touch:**
- `src/server/payload/collections/AccessCodes.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — import + add to collections array)

**Behavior:**
Create new Payload collection with slug `access-codes`:
- `code`: text, unique, required, index: true — The access code string
- `label`: text — Friendly name for admin reference (e.g., "Maccabi School 2024")
- `scopeType`: select, required, defaultValue: `'lesson'` — Only `lesson` supported per clarified spec
  - Options: `lesson` (only option for now, extensible later)
- `scopeTarget`: relationship to `lessons`, required — The lesson this code unlocks
  - Show condition: `scopeType === 'lesson'`
- `maxRedemptions`: number, optional, min: 0 — Maximum uses (null = unlimited)
- `currentRedemptions`: number, defaultValue: 0, readOnly in admin — Auto-incremented counter
- `isActive`: checkbox, defaultValue: true — Admin toggle to enable/disable
- `expiresAt`: date, optional — Expiration date (per clarified answer #4)
- `tenant`: tenantField
- `createdBy`: createdByField

**Access Control:**
- `create`: adminOnly
- `read`: adminOnly (only admins see codes list)
- `update`: adminOnly
- `delete`: adminOnly

**Tests (FAIL before, PASS after):**
- Test file: `tests/int/access-codes.int.spec.ts` (continued)
- Test 1: `Admin can create an access code with all fields` — Create via Local API with admin user
- Test 2: `Access code must have unique code string` — Attempt duplicate, expect error
- Test 3: `Non-admin cannot create access codes` — Create with student user, expect denied
- Run: `pnpm test:int tests/int/access-codes.int.spec.ts`

**Acceptance Criteria:**
- [ ] Collection registered in payload.config.ts
- [ ] Admin can CRUD access codes
- [ ] Code field is unique
- [ ] Non-admin users cannot access

---

## Step 4: Create CodeRedemptions Collection (FR-004)

**Files to Touch:**
- `src/server/payload/collections/CodeRedemptions.ts` (NEW)
- `src/payload.config.ts` (MODIFIED — import + add to collections array)

**Behavior:**
Create new Payload collection with slug `code-redemptions`:
- `code`: relationship to `access-codes`, required, index: true
- `user`: relationship to `users`, required, index: true
- `lessonId`: text, required, index: true — The lesson ID that was unlocked
- `redeemedAt`: date, required — Timestamp of redemption
- `tenant`: tenantField

**Access Control:**
- `create`: authenticated (server-side endpoint creates these)
- `read`: Custom access — Admin sees all; authenticated user sees own redemptions
- `update`: adminOnly (no user modification)
- `delete`: adminOnly

Custom read access function:
```
Admins → true (see all)
Authenticated → { user: { equals: user.id } } (own records only)
Anonymous → false
```

**Tests (FAIL before, PASS after):**
- Test file: `tests/int/access-codes.int.spec.ts` (continued)
- Test 1: `Code redemption can be created with valid fields` — Create via Local API
- Test 2: `Student can only read own redemptions` — Create for user1, verify user2 cannot see
- Test 3: `Admin can read all redemptions` — Admin sees all records
- Run: `pnpm test:int tests/int/access-codes.int.spec.ts`

**Note on FR-003 (User Redeemed Codes Field)**: The spec's FR-003 proposes adding a `redeemedAccessCodes` array field to the Users collection. This plan intentionally replaces that with the `code-redemptions` collection (FR-004) + the check endpoint (Step 9). Querying a separate collection avoids unbounded arrays on the User document and is the standard Payload pattern for audit/event data. The `code-redemptions` collection serves both the persistence (FR-003) and audit trail (FR-004) requirements.

**Acceptance Criteria:**
- [ ] Collection registered in payload.config.ts
- [ ] Redemptions track user, code, lesson, timestamp
- [ ] Access control enforced: users see only own, admins see all

---

## Step 5: Create Code Redemption API Endpoint (FR-005)

**Files to Touch:**
- `src/app/api/access-codes/redeem/route.ts` (NEW)

**Behavior:**
`POST /api/access-codes/redeem`

Request body (validated with Zod):
```json
{ "code": "MACCABI-2024-FREE", "lessonId": "abc123" }
```

Validation logic:
1. Authenticate user via `payload.auth({ headers })`
2. Parse + validate body with Zod schema
3. Find access code: `payload.find({ collection: 'access-codes', where: { code: { equals: body.code }, isActive: { equals: true } } })`
4. If not found → 404: `{ success: false, error: 'invalid_code' }`
5. Check expiration: if `expiresAt` exists and is past → 410: `{ success: false, error: 'expired_code' }`
6. Check max redemptions: if `maxRedemptions` set and `currentRedemptions >= maxRedemptions` → 410: `{ success: false, error: 'max_redemptions_reached' }`
7. Check scope: if `scopeType === 'lesson'`, verify `scopeTarget` matches `lessonId`
8. Check duplicate: find existing redemption for (user, code, lesson)
9. If already redeemed → 200: `{ success: true, alreadyRedeemed: true }`
10. Atomic operations:
    - Increment `currentRedemptions` on the access code
    - Create `code-redemptions` record
11. Return 200: `{ success: true, lessonId }`

**Tests (FAIL before, PASS after):**
- Test file: `tests/int/access-codes.int.spec.ts` (continued)
- Test 1: `Redeem valid code returns success` — POST with valid code → 200
- Test 2: `Redeem invalid code returns 404` — POST with wrong code → 404
- Test 3: `Redeem expired code returns 410` — Create expired code, redeem → 410
- Test 4: `Redeem code at max redemptions returns 410` — Set maxRedemptions=1, redeem twice → 410 on second
- Test 5: `Unauthenticated user gets 401` — POST without auth → 401
- Test 6: `Already-redeemed code returns success with alreadyRedeemed flag` — Redeem same code twice → 200 with alreadyRedeemed: true
- Run: `pnpm test:int tests/int/access-codes.int.spec.ts`

**Acceptance Criteria:**
- [ ] Authenticated users can redeem valid codes
- [ ] Invalid/expired/exhausted codes are rejected with appropriate errors
- [ ] Duplicate redemption is idempotent (returns success, no double-count)
- [ ] Redemption is recorded in code-redemptions collection
- [ ] currentRedemptions counter is incremented atomically

---

## Step 6: Add i18n Translation Strings (NFR-001)

**Files to Touch:**
- `src/i18n/en.json` (MODIFIED — add keys under `accessControl`)
- `src/i18n/he.json` (MODIFIED — add keys under `accessControl`)

**Behavior:**
Add new keys to the `accessControl` namespace in both translation files:

English (`en.json`):
```json
"accessCodeTitle": "Access Restricted",
"accessCodeDescription": "Please insert your school access code to unlock this content.",
"accessCodePlaceholder": "Enter access code",
"accessCodeUnlock": "Unlock",
"accessCodeError": "Incorrect code. Please check with your teacher.",
"accessCodeSuccess": "Content unlocked!",
"accessCodeExpired": "This code has expired.",
"accessCodeMaxReached": "This code has reached its maximum uses."
```

Hebrew (`he.json`):
```json
"accessCodeTitle": "הגישה מוגבלת",
"accessCodeDescription": "אנא הזן את קוד הגישה של בית הספר שלך כדי לפתוח תוכן זה.",
"accessCodePlaceholder": "הזן קוד גישה",
"accessCodeUnlock": "פתח",
"accessCodeError": "קוד שגוי. אנא בדוק עם המורה שלך.",
"accessCodeSuccess": "התוכן נפתח!",
"accessCodeExpired": "קוד זה פג תוקף.",
"accessCodeMaxReached": "קוד זה הגיע למקסימום השימושים."
```

**Tests (FAIL before, PASS after):**
- Test file: `tests/unit/i18n-access-code-keys.test.ts` (NEW)
- Test 1: `en.json contains all accessCode translation keys` — Read JSON, verify keys exist
- Test 2: `he.json contains all accessCode translation keys` — Read JSON, verify keys exist
- Run: `pnpm test:unit tests/unit/i18n-access-code-keys.test.ts`

**Acceptance Criteria:**
- [ ] All 8 new keys exist in both en.json and he.json
- [ ] Existing keys are unchanged

---

## Step 7: Create AccessCodeGateModal Component (FR-006)

**Files to Touch:**
- `src/ui/web/auth/AccessCodeGateModal.tsx` (NEW)

**Behavior:**
Create a client component (`'use client'`) that:
1. Renders a non-dismissible Dialog (similar to `AuthGateModal`)
2. Shows title (`accessCodeTitle`) and description (`accessCodeDescription`)
3. Contains a text input for code entry
4. Contains "Unlock" button
5. On submit:
   - Calls `POST /api/access-codes/redeem` with `{ code, lessonId }`
   - On success: calls `onSuccess()` callback prop
   - On error: shows appropriate error message from translations
6. Shows loading state during API call
7. Shows error messages for invalid/expired/exhausted codes

Props interface:
```typescript
interface AccessCodeGateModalProps {
  isOpen: boolean
  lessonId: string
  onSuccess: () => void
}
```

**Tests (FAIL before, PASS after):**
- Test file: `tests/unit/components/AccessCodeGateModal.test.tsx` (NEW)
- Test 1: `Renders modal when isOpen is true` — Render component, verify dialog visible
- Test 2: `Shows error message on invalid code` — Mock fetch to return error, verify error shown
- Run: `pnpm test:unit tests/unit/components/AccessCodeGateModal.test.tsx`

**Acceptance Criteria:**
- [ ] Modal shows with input field and Unlock button
- [ ] Error messages display correctly
- [ ] Success callback fires on successful redemption
- [ ] Loading state shown during API call

---

## Step 8: Integrate Access Code Gate into AccessGateProvider (FR-006)

**Files to Touch:**
- `src/ui/web/auth/AccessGateProvider.tsx` (MODIFIED — add accessCode handling)
- `src/client/hooks/useAccessGate.ts` (MODIFIED — add accessCode state)

**Behavior:**

In `useAccessGate.ts`:
- Add `isAccessCode = accessType === 'accessCode'` flag
- When `isAccessCode && user`:
  - Check if user has already redeemed by calling `/api/access-codes/check?lessonId=X` (or cache in state)
  - If not redeemed → `showAccessCodeModal = true`
  - If redeemed → `showAccessCodeModal = false`
- Return new state: `showAccessCodeModal`, `onAccessCodeSuccess` (to dismiss modal)

In `AccessGateProvider.tsx`:
- Import `AccessCodeGateModal`
- When `accessType === 'accessCode'` and user is authenticated:
  - Show `AccessCodeGateModal` if user hasn't redeemed for this lesson
  - On success: dismiss modal and reveal content
- When `accessType === 'accessCode'` and user is NOT authenticated:
  - Show the existing `AuthGateModal` (mandatory login first), then show code gate

Need to pass `lessonId` to AccessGateProvider — add new optional prop `lessonId?: string`.

**Files also touching:**
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED):
  1. Pass `lessonId={lesson.id}` to all `<AccessGateProvider>` instances
  2. Add server-side block for `accessCode` type similar to `mandatory` block (line 69):
     When `effectiveAccessType === 'accessCode' && !(await isAuthenticatedServer())`, render only the gate provider with empty content. This prevents unauthenticated users from seeing server-rendered content via SSR.

**Tests (FAIL before, PASS after):**
- Test file: `tests/unit/components/AccessGateProvider-accessCode.test.tsx` (NEW)
- Test 1: `Shows login modal for unauthenticated user with accessCode type` — Render with no user, verify AuthGateModal shows
- Test 2: `Shows code gate modal for authenticated user without redemption` — Render with user mock, verify AccessCodeGateModal shows
- Run: `pnpm test:unit tests/unit/components/AccessGateProvider-accessCode.test.tsx`

**Acceptance Criteria:**
- [ ] `accessCode` type shows login-first for anonymous users
- [ ] `accessCode` type shows code entry for authenticated users
- [ ] Content is blurred when code hasn't been entered
- [ ] Content reveals after successful redemption
- [ ] Existing `free`, `mandatory`, `gated` flows are unaffected

---

## Step 9: Add Check-Redemption API Endpoint

**Files to Touch:**
- `src/app/api/access-codes/check/route.ts` (NEW)

**Behavior:**
`GET /api/access-codes/check?lessonId=abc123`

1. Authenticate user
2. Query `code-redemptions` for this user + lessonId
3. Return `{ redeemed: boolean }`

This is used by the frontend to determine if the user needs to enter a code.

**Tests (FAIL before, PASS after):**
- Test file: `tests/int/access-codes.int.spec.ts` (continued)
- Test 1: `Check returns redeemed=false for unredeemed lesson` — Query for non-redeemed → false
- Test 2: `Check returns redeemed=true after redemption` — Redeem then check → true
- Run: `pnpm test:int tests/int/access-codes.int.spec.ts`

**Acceptance Criteria:**
- [ ] Returns `redeemed: true` for previously redeemed content
- [ ] Returns `redeemed: false` for non-redeemed content
- [ ] Requires authentication (401 for anonymous)

---

## Step 10: Admin CSV Export (FR-007)

**Files to Touch:**
- `src/app/api/access-codes/export/route.ts` (NEW)

**Behavior:**
`GET /api/access-codes/export?codeId=xyz123`

1. Authenticate user + verify admin role
2. Query all `code-redemptions` where `code` equals `codeId`, populate user
3. Generate CSV string with headers: `Student Name,Email,Date Redeemed`
4. Return with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="access-code-report.csv"`

**Tests (FAIL before, PASS after):**
- Test file: `tests/int/access-codes.int.spec.ts` (continued)
- Test 1: `Admin can export CSV for a code` — Create redemptions, export → valid CSV
- Test 2: `Non-admin gets 403` — Student requests export → 403
- Run: `pnpm test:int tests/int/access-codes.int.spec.ts`

**Acceptance Criteria:**
- [ ] Admin can download CSV with student name, email, date
- [ ] Non-admin users are denied
- [ ] CSV format is valid and parseable

---

## Step 11: Type Generation & Quality Gates

**Files to Touch:**
- No new files, run commands

**Behavior:**
1. Run `pnpm generate:types` to regenerate Payload types with new collections
2. Run `pnpm generate:importmap` to update admin import map
3. Run `pnpm -s tsc --noEmit` to verify no type errors
4. Run `pnpm -s lint` to verify no lint errors
5. Run `pnpm test:int tests/int/access-codes.int.spec.ts` to verify all integration tests pass

**Acceptance Criteria:**
- [ ] Types generated successfully
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] All access-codes tests pass

---

## Dependency Graph

```
Step 1 (access-types) 
  → Step 2 (collection options)
  → Step 3 (AccessCodes collection) → Step 4 (CodeRedemptions) → Step 5 (Redeem API) → Step 9 (Check API) → Step 10 (Export API)
Step 6 (i18n) → Step 7 (Modal component) → Step 8 (Integration)
Step 11 (quality gates) — runs after all steps
```

Steps 1-2 and Step 6 can run in parallel.
Steps 3-4 depend on Step 1.
Steps 5, 9, 10 depend on Steps 3 + 4.
Step 7 depends on Step 6.
Step 8 depends on Steps 5, 7, 9.
Step 11 is last.
