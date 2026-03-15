# Code Review: 260315-auto-791

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| FR-001: Add `accessCode` access type | `src/infra/auth/access-types.ts:8` — added to ACCESS_TYPES | `tests/unit/i18n-access-code-keys.test.ts` (indirect); NO dedicated unit test for access-types | ⚠️ Untested |
| FR-001: Lessons can have `accessCode` | `src/server/payload/collections/Lessons.ts:165-168` | `tests/int/access-codes.int.spec.ts:110-140` | ✅ Met |
| FR-001: Courses can have `accessCode` | `src/server/payload/collections/Courses.ts:155,172` | `tests/int/access-codes.int.spec.ts:142-174` | ✅ Met |
| FR-001: Frontend shows code gate modal | `src/ui/web/auth/AccessGateProvider.tsx:52,115-122` | NO unit test for AccessGateProvider-accessCode | ⚠️ Untested |
| FR-002: Access Codes collection | `src/server/payload/collections/AccessCodes.ts` (full file) | `tests/int/access-codes.int.spec.ts:208-291` | ✅ Met |
| FR-002: code field unique | `AccessCodes.ts:43` unique:true | `tests/int/access-codes.int.spec.ts:237-271` | ✅ Met |
| FR-002: scopeType field | `AccessCodes.ts:60-68` — only `lesson` option | `tests/int/access-codes.int.spec.ts:229` | 🔄 Partial |
| FR-002: maxRedemptions/currentRedemptions | `AccessCodes.ts:82-98` | `tests/int/access-codes.int.spec.ts:219,230-231` | ✅ Met |
| FR-002: isActive/expiresAt | `AccessCodes.ts:101-116` | `tests/int/access-codes.int.spec.ts:232` (isActive only) | ⚠️ Untested (expiresAt) |
| FR-002: createdBy/tenant | `AccessCodes.ts:118-120` | NO test | ⚠️ Untested |
| FR-003: User redeemed codes field | NOT IMPLEMENTED (replaced by FR-004 approach) | N/A | 🔄 Partial |
| FR-004: Code Redemptions collection | `src/server/payload/collections/CodeRedemptions.ts` (full file) | `tests/int/access-codes.int.spec.ts:294-367` | ✅ Met |
| FR-004: Access control (own records) | `CodeRedemptions.ts:25` uses `authenticatedOrOwner` | `tests/int/access-codes.int.spec.ts:317-351` | ✅ Met |
| FR-005: Redeem API endpoint | `src/app/api/access-codes/redeem/route.ts` (full file) | `tests/int/access-codes.int.spec.ts:369-401` (collection-level only, no HTTP tests) | ⚠️ Untested |
| FR-005: Auth check | `redeem/route.ts:23-26` | NO HTTP-level test | ⚠️ Untested |
| FR-005: Code validation (active + exists) | `redeem/route.ts:49-61` | NO HTTP-level test | ⚠️ Untested |
| FR-005: Expiration check | `redeem/route.ts:66-71` | NO test | ⚠️ Untested |
| FR-005: Max redemption check | `redeem/route.ts:74-79` | NO test | ⚠️ Untested |
| FR-005: Scope validation | `redeem/route.ts:82-91` | NO test | ⚠️ Untested |
| FR-005: Idempotent duplicate | `redeem/route.ts:94-117` | NO test | ⚠️ Untested |
| FR-005: Increment + create record | `redeem/route.ts:119-140` | NO test | ⚠️ Untested |
| FR-006: Access Code Gate Modal | `src/ui/web/auth/AccessCodeGateModal.tsx` (full file) | NO test | ⚠️ Untested |
| FR-006: Blur effect on content | `src/ui/web/auth/AccessGateProvider.tsx:124-127` | NO test | ⚠️ Untested |
| FR-007: Admin CSV export | `src/app/api/access-codes/export/route.ts` (full file) | `tests/int/access-codes.int.spec.ts:421-443` (collection query only) | ⚠️ Untested |
| NFR-001: EN translations | `src/i18n/en.json:323-330` | `tests/unit/i18n-access-code-keys.test.ts:26-79` | ✅ Met |
| NFR-001: HE translations | `src/i18n/he.json:323-330` | `tests/unit/i18n-access-code-keys.test.ts:82-136` | ✅ Met |
| NFR-002: Server-side validation | `redeem/route.ts:23-91` | NO HTTP-level test | ⚠️ Untested |
| NFR-002: Admin-only code creation | `AccessCodes.ts:32-35` adminOnly | `tests/int/access-codes.int.spec.ts:273-291` | ✅ Met |
| NFR-002: Users read own redemptions | `CodeRedemptions.ts:25` authenticatedOrOwner | `tests/int/access-codes.int.spec.ts:317-351` | ✅ Met |
| NFR-002: Rate limiting | NOT IMPLEMENTED | N/A | ❌ Missing |
| AC-1: Student enters code, sees lesson | `AccessGateProvider.tsx + AccessCodeGateModal.tsx + redeem/route.ts` | NO E2E test | ⚠️ Untested |
| AC-2: Admin sees redemption details | `CodeRedemptions collection + export/route.ts` | `tests/int/access-codes.int.spec.ts:421-443` (partial) | ⚠️ Untested |
| AC-3: Unflagged content stays open | `access-types.ts:44` returns 'free' by default | `tests/int/access-codes.int.spec.ts:176-205` | ✅ Met |
| AC-5: Redeemed students not re-asked | `useAccessGate.ts:119-143` check API | NO test | ⚠️ Untested |
| AC-8: CSV export | `export/route.ts` | NO HTTP-level test | ⚠️ Untested |

**Spec Coverage**: 12/34 requirements met (35%), 19 untested (56%), 1 missing (3%), 2 partial (6%)

## Code Quality Findings

### Critical

1. **[AccessGateProvider.tsx:118-121] onSuccess callback is a no-op — modal never closes after successful redemption.**
   The `onSuccess` callback in AccessGateProvider does nothing: `() => { /* empty comment */ }`. After calling `POST /api/access-codes/redeem` successfully, `AccessCodeGateModal` calls `onSuccess()`, but this doesn't update `hasRedeemedCode` state in `useAccessGate`. The hook only sets `hasRedeemedCode` via the `/api/access-codes/check` API call on mount. The modal will remain open until the user refreshes the page.

   **Fix**: The `onSuccess` callback must call a function that sets `hasRedeemedCode = true` in the hook state. Either export `setHasRedeemedCode` from the hook or add an `onAccessCodeSuccess` handler.

2. **[useAccessGate.ts:119-143] Missing `lessonId` in AccessGateProvider callers — gate never activates for accessCode type.**
   The lesson page (`page.tsx`) does NOT pass `lessonId` to any `<AccessGateProvider>` instance. The plan (Step 8) explicitly required: "Pass `lessonId={lesson.id}` to all `<AccessGateProvider>` instances." Without `lessonId`, the check in `useAccessGate.ts:122` (`!lessonId`) will bail out, and `showAccessCodeModal` will remain `false`. The access code gate will never show.

3. **[page.tsx:68-80] Missing server-side block for `accessCode` type.**
   The lesson page only has a server-side block for `effectiveAccessType === 'mandatory'`. The plan (Step 8) explicitly required adding a similar block for `accessCode`: "When `effectiveAccessType === 'accessCode' && !(await isAuthenticatedServer())`, render only the gate provider with empty content." Without this, unauthenticated users see server-rendered lesson content before the client-side gate kicks in.

4. **[useAccessGate.ts:152-154] Anonymous users see no gate for `accessCode` type.**
   When user is anonymous (`isAnonymous=true`), `showAccessCodeModal` is `false` (requires `!!user`), `showMandatoryModal` is `false` (requires `isMandatory`), and `showGatedModal` is `false` (requires `isGated`). Result: anonymous users see content with no gate at all. The plan required showing `AuthGateModal` first for unauthenticated users, then the code gate.

### Major

5. **[redeem/route.ts:119-140] Race condition in redemption counter increment.**
   The update to `currentRedemptions` (line 121-128) and the creation of the redemption record (line 131-140) are not atomic. Two concurrent redemptions could both read the same `currentRedemptions`, both pass the max check, and both increment — resulting in `currentRedemptions` being incremented by only 1 instead of 2. This could allow exceeding `maxRedemptions`.

6. **[redeem/route.ts:122,132] `as any` type assertions — types not generated.**
   The build report acknowledges types were not generated. This means the `access-codes` and `code-redemptions` collection slugs are not in the `CollectionSlug` union type. The `as any` assertions mask real type errors and will cause confusion for future developers.

7. **[export/route.ts:50-56] CSV injection vulnerability.**
   Student names and emails are embedded directly into CSV cells without sanitizing for CSV injection. If a student name or email contains `=`, `+`, `-`, or `@` as the first character, it could be interpreted as a formula by Excel. Values should be prefixed with `'` or escaped.

8. **[CodeRedemptions.ts:74] `timestamps: false` prevents Payload audit trail.**
   Setting `timestamps: false` removes Payload's built-in `createdAt`/`updatedAt` fields. While `redeemedAt` is manually set, losing `updatedAt` means no way to detect if a record was tampered with.

9. **[tests/int/access-codes.int.spec.ts:369-401] Step 5 tests don't actually test the API.**
   The "redeem valid code returns success" test (line 370-382) merely queries the access-codes collection — it does NOT call the `/api/access-codes/redeem` endpoint. The "unauthenticated user cannot redeem" test (line 384-400) tests collection-level access, not the API route. The plan specified 6 API-level tests for Step 5; none were implemented.

10. **No unit test for `resolveAccessType` with `accessCode`.**
    The plan (Step 1) specified `tests/unit/access-types.test.ts` with 3 tests. This file was never created. The `resolveAccessType` function is critical — verifying it handles `'accessCode'` correctly is essential.

### Minor

11. **[AccessCodeGateModal.tsx:82,90] Inline CSS classes instead of using project UI components.**
    The input and button use raw Tailwind class strings instead of importing `Input` and `Button` from `@/ui/web/components/`. The existing codebase uses shadcn/ui components for form elements.

12. **[AccessCodes.ts:82] `min: 1` but plan says `min: 0`.**
    The plan specifies `maxRedemptions: number, optional, min: 0`. The implementation uses `min: 1`. This prevents setting maxRedemptions to 0 (which would mean "no uses allowed"), though this is a minor edge case.

13. **[check/route.ts:35] `as any` type assertion.**
    Same type generation issue as the redeem endpoint.

14. **[export/route.ts:40] `as any` type assertion.**
    Same type generation issue.

15. **[AccessGateProvider.tsx:57-79] Analytics event not tracking `accessCode` trigger type.**
    The `triggerType` tracking only handles `mandatory`, `gated`, and `warning`. It does not track `accessCode` as a trigger type, so analytics will miss code gate impressions.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | Reuses `adminOnly`, `authenticated`, `authenticatedOrOwner` |
| No duplicated utilities | ✅ | Reuses `tenantField`, `createdByField` |
| No duplicated validation schemas | ✅ | Uses Zod in redeem endpoint |
| Existing UI components used where possible | ❌ | Input/Button use raw Tailwind instead of shadcn components |
| No `any` type escapes | ❌ | 4 `as any` assertions in API routes, tests heavily use `as any` |
| Functions reasonably sized (<50 lines) | ✅ | All functions are reasonable size |
| No magic numbers/strings | ✅ | No magic numbers |
| Error handling on all async ops | ✅ | All async ops wrapped in try/catch |

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: No (Critical gaps)
- **Recommendation**: Fix Required

### Critical issues requiring fixes:
1. **`onSuccess` no-op** — modal never dismisses after redemption
2. **`lessonId` not passed** to AccessGateProvider in lesson page — gate never activates
3. **No server-side block** for `accessCode` in lesson page — SSR content leak
4. **Anonymous users** see no gate at all for `accessCode` type
5. **No rate limiting** on redemption endpoint (NFR-002 MUST)
6. **>50% requirements untested** — plan specified 5+ test files, only 2 created (0 unit tests for access-types or components)
