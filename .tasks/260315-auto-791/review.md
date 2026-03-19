# Code Review: 260315-auto-791

## Spec Satisfaction

| Requirement | Code Location | Status |
|-------------|--------------|--------|
| FR-001: Add `accessCode` to AccessType | `src/infra/auth/access-types.ts:9` | ✅ Met |
| FR-001: Lessons accept `accessCode` | `src/server/payload/collections/Lessons.ts:168-171` | ✅ Met |
| FR-001: Courses accept `accessCode` | `src/server/payload/collections/Courses.ts:158,179` | ✅ Met |
| FR-001: Frontend shows code gate modal | `src/ui/web/auth/AccessGateProvider.tsx:136-143`, `src/client/hooks/useAccessGate.ts:153-154` | ✅ Met |
| FR-002: `access-codes` collection | `src/server/payload/collections/AccessCodes.ts` | ✅ Met |
| FR-002: `code` field (unique, text) | `AccessCodes.ts:71-79` | ✅ Met |
| FR-002: `scopeType` field | `AccessCodes.ts:92-99` — only `lesson` option (per clarification) | ✅ Met |
| FR-002: `scopeTarget` relationship | `AccessCodes.ts:102-111` | ✅ Met |
| FR-002: `maxRedemptions` / `currentRedemptions` | `AccessCodes.ts:113-131` | ✅ Met |
| FR-002: `isActive` checkbox | `AccessCodes.ts:165-172` | ✅ Met |
| FR-002: `expiresAt` date | `AccessCodes.ts:180-186` | ✅ Met |
| FR-002: `createdBy` relationship | `AccessCodes.ts:191` via `createdByField` | ✅ Met |
| FR-002: Admin-only access | `AccessCodes.ts:47-52` | ✅ Met |
| FR-002: Registered in payload.config | `src/payload.config.ts:148` | ✅ Met |
| FR-003: User redeemed codes tracking | Replaced by `code-redemptions` collection (FR-004) — plan deviation documented | 🔄 Partial |
| FR-004: `code-redemptions` collection | `src/server/payload/collections/CodeRedemptions.ts` | ✅ Met |
| FR-004: Fields (code, user, lessonId, redeemedAt) | `CodeRedemptions.ts:30-70` | ✅ Met |
| FR-004: Access control (own records) | `CodeRedemptions.ts:25` uses `authenticatedOrOwner` | ✅ Met |
| FR-004: Registered in payload.config | `src/payload.config.ts:149` | ✅ Met |
| FR-005: Redeem API endpoint | `src/app/api/access-codes/redeem/route.ts` | ✅ Met |
| FR-005: Auth check | `redeem/route.ts:23-26` | ✅ Met |
| FR-005: Zod validation | `redeem/route.ts:13-16, 38-44` | ✅ Met |
| FR-005: Code lookup (active only) | `redeem/route.ts:49-61` | ✅ Met |
| FR-005: Expiration check | `redeem/route.ts:66-71` | ✅ Met |
| FR-005: Max redemptions check | `redeem/route.ts:74-79` | ✅ Met |
| FR-005: Scope verification | `redeem/route.ts:82-91` | ✅ Met |
| FR-005: Duplicate idempotent | `redeem/route.ts:94-117` | ✅ Met |
| FR-005: Increment + create record | `redeem/route.ts:121-140` | ✅ Met |
| FR-006: AccessCodeGateModal component | `src/ui/web/auth/AccessCodeGateModal.tsx` | ✅ Met |
| FR-006: Dialog with blur | `AccessCodeGateModal.tsx:70-71`, `AccessGateProvider.tsx:155` | ✅ Met |
| FR-006: Input + Unlock button | `AccessCodeGateModal.tsx:77-93` | ✅ Met |
| FR-006: Error states | `AccessCodeGateModal.tsx:48-60, 86` | ✅ Met |
| FR-006: Success callback | `AccessCodeGateModal.tsx:44-45` | ✅ Met |
| FR-007: CSV export | `src/app/api/access-codes/export/route.ts` | ✅ Met |
| FR-007: Admin-only | `export/route.ts:24-27` | ✅ Met |
| FR-007: CSV with name/email/date | `export/route.ts:49-56` | ✅ Met |
| NFR-001: EN translations (8 keys) | `src/i18n/en.json:328-335` | ✅ Met |
| NFR-001: HE translations (8 keys) | `src/i18n/he.json:328-335` | ✅ Met |
| NFR-002: Server-side validation | `redeem/route.ts` — all validation server-side | ✅ Met |
| NFR-002: Admin-only code management | `AccessCodes.ts:47-52` adminOnly all ops | ✅ Met |
| NFR-002: Users read own redemptions | `CodeRedemptions.ts:25` authenticatedOrOwner | ✅ Met |
| NFR-002: Rate limiting | NOT IMPLEMENTED | ❌ Missing |
| Check API (plan Step 9) | `src/app/api/access-codes/check/route.ts` | ✅ Met |

**Spec Coverage**: 38/39 requirement items have corresponding code. 1 missing (rate limiting). 1 partial (FR-003 replaced by FR-004 — acceptable architectural deviation).

## Code Quality Findings

### Critical

1. **[MULTIPLE FILES] Unresolved git merge conflicts throughout codebase — code will not compile.**
   The following files contain `<<<<<<<`, `=======`, `>>>>>>>` conflict markers:
   - `src/infra/auth/access-types.ts:8-12` — HEAD has `accessCode`, origin/dev has `paid`
   - `src/server/payload/collections/AccessCodes.ts:2-16, 21-29, 34-69, 77-163, 170-200` — massive conflicts throughout
   - `src/server/payload/collections/Lessons.ts:167-174` — HEAD has `accessCode`, origin/dev has `paid`
   - `src/server/payload/collections/Courses.ts:157-161, 178-182` — same conflict pattern
   - `src/ui/web/auth/AccessGateProvider.tsx:29-37, 46-51, 65-70, 134-149` — multiple conflicts

   These files are **broken** and will cause build failures. The merge between this task's branch and origin/dev was not resolved.

2. **[payload.config.ts:148,176] `AccessCodes` is registered TWICE in the collections array.**
   Lines 148 and 176 both add `AccessCodes` to the collections. This will cause a Payload startup error — duplicate collection slugs are not allowed.

3. **[page.tsx:69-101] `lessonId` prop NOT passed to any AccessGateProvider instance.**
   The plan (Step 8) and build.md both state `lessonId={lesson.id}` was added. Inspecting the actual file shows **none** of the three `<AccessGateProvider>` instances (lines 72, 128, 187) pass `lessonId`. This means the `useAccessGate` hook's check at line 122 (`!lessonId`) always bails out, and `showAccessCodeModal` stays `false`. The access code gate will **never appear**.

4. **[page.tsx:69-101] No server-side block for `accessCode` type.**
   The plan required: "When `effectiveAccessType === 'accessCode' && !(await isAuthenticatedServer())`, render only the gate provider with empty content." The actual file only blocks for `mandatory` (line 70) and `paid` (line 84). Unauthenticated users visiting an `accessCode` lesson will see full server-rendered content.

5. **[AccessGateProvider.tsx:139-142] `onSuccess` callback is a no-op.**
   The `onSuccess` prop passed to `AccessCodeGateModal` does nothing: `() => { /* comment */ }`. After a user successfully redeems a code via the API, the modal will remain open. The `hasRedeemedCode` state in `useAccessGate` is never updated on success because the only place it gets set to `true` is the `/api/access-codes/check` call on mount (line 132), not on redemption.
   
   Build.md claims this was fixed ("Exported `setHasRedeemedCode` from `useAccessGate`"), but looking at the hook's return type (line 192-201), `setHasRedeemedCode` is **not** returned. The fix was not applied.

6. **[useAccessGate.ts:152-154] Anonymous users see no gate for `accessCode` type.**
   When `accessType === 'accessCode'` and user is anonymous: `showAccessCodeModal` = `false` (requires `!!user`), `showMandatoryModal` = `false`, `showGatedModal` = `false`. **No modal shows at all**, and the `isBlocked` flag will be `false`, so content is revealed unblocked. Anonymous users bypass the gate entirely.

### Major

7. **[redeem/route.ts:121-140] Race condition — increment and create are non-atomic.**
   `payload.update` (increment counter, line 121-128) and `payload.create` (redemption record, line 131-140) are sequential, not transactional. Two concurrent redemptions could both read `currentRedemptions=9`, both pass the `< maxRedemptions=10` check, then both increment to 10 — allowing 11 total redemptions.

8. **[export/route.ts:50-56] CSV injection vulnerability.**
   Student names and emails are placed into CSV cells wrapped in double-quotes, but without sanitizing for CSV injection characters (`=`, `+`, `-`, `@`). Malicious input like `=HYPERLINK("http://evil.com")` in a student name would execute when opened in Excel.

9. **[AccessCodeGateModal.tsx:77-93] Uses raw Tailwind class strings instead of shadcn/ui `Input`/`Button` components.**
   The existing codebase uses `Input` from `@/ui/web/components/input` and `Button` from `@/ui/web/components/button`. The modal uses inline Tailwind classes duplicating these components' styles. This violates the project's component reuse pattern and will diverge visually if the design system is updated.

10. **[CodeRedemptions.ts:74] `timestamps: false` disables Payload audit fields.**
    Disabling timestamps removes `createdAt` and `updatedAt`. The `updatedAt` field is valuable for detecting if records were tampered with. Standard project pattern is to leave timestamps enabled.

### Minor

11. **[AccessCodes.ts:116] `min: 1` for `maxRedemptions` but plan specifies `min: 0`.**
    Setting `min: 1` means you can't set `maxRedemptions` to 0. The plan says `min: 0`. This is a minor inconsistency but not functionally critical since 0 is an unusual value for "max uses."

12. **[redeem/route.ts:122,132; check/route.ts:35; export/route.ts:40] `as any` type assertions.**
    Four instances of `as any` used to bypass type checking for collection slugs. Build.md acknowledges this is due to ungenerated types. These should be removed after `pnpm generate:types` is run.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | Reuses `adminOnly`, `authenticated`, `authenticatedOrOwner` |
| No duplicated utilities | ✅ | Reuses `tenantField`, `createdByField` |
| No duplicated validation schemas | ✅ | Uses Zod in redeem endpoint |
| Existing UI components used where possible | ❌ | `AccessCodeGateModal` uses raw Tailwind instead of `Input`/`Button` from shadcn |
| No `any` type escapes | ❌ | 4 `as any` in API routes (known — pending type generation) |
| Functions reasonably sized (<50 lines) | ✅ | All functions are reasonable |
| No magic numbers/strings | ✅ | No magic values |
| Error handling on all async ops | ✅ | All async wrapped in try/catch |

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: No — Critical integration gaps
- **Recommendation**: Fix Required

### Critical fixes needed before merge:
1. **Resolve all git merge conflicts** — 5 files have unresolved `<<<<<<<` markers; code will not compile
2. **Remove duplicate `AccessCodes` registration** in `payload.config.ts` (line 176)
3. **Pass `lessonId={lesson.id}`** to all `<AccessGateProvider>` instances in lesson page
4. **Add server-side block** for `accessCode` type in lesson page (matching the mandatory/paid pattern)
5. **Fix `onSuccess` callback** — return `setHasRedeemedCode` from `useAccessGate` hook and wire it into `AccessGateProvider.onSuccess`
6. **Handle anonymous users** for `accessCode` type — show login gate first (server-side block covers this once fix #4 is applied)
