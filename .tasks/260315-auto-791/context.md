# Codebase Context: 260315-auto-791

## Files to Modify
- `src/infra/auth/access-types.ts` (lines 8-14, 32-44) — Add `accessCode` to ACCESS_TYPES and ensure resolveAccessType handles it
- `src/server/payload/collections/Lessons.ts` (lines 153-171) — Add `accessCode` option to accessType select field
- `src/server/payload/collections/Courses.ts` (lines 147-177) — Add `accessCode` option to accessType and pageAccessType select fields
- `src/payload.config.ts` (lines 143-170) — Register new AccessCodes and CodeRedemptions collections
- `src/ui/web/auth/AccessGateProvider.tsx` (full file) — Add accessCode gate handling, new lessonId prop
- `src/client/hooks/useAccessGate.ts` (full file) — Add accessCode modal state management
- `src/i18n/en.json` (line 314-323, accessControl section) — Add accessCode translation keys
- `src/i18n/he.json` (line 314-323, accessControl section) — Add accessCode translation keys (Hebrew)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (lines 62, 107, 166) — Pass lessonId to AccessGateProvider
- `src/server/payload/collections/AccessCodes.ts` (NEW) — New access codes collection
- `src/server/payload/collections/CodeRedemptions.ts` (NEW) — New code redemptions audit trail collection
- `src/app/api/access-codes/redeem/route.ts` (NEW) — Code redemption API endpoint
- `src/app/api/access-codes/check/route.ts` (NEW) — Check if user has redeemed a code for a lesson
- `src/app/api/access-codes/export/route.ts` (NEW) — Admin CSV export endpoint
- `src/ui/web/auth/AccessCodeGateModal.tsx` (NEW) — Access code entry modal component

## Files to Read (reference patterns)
- `src/server/payload/collections/UserProgress.ts` — Pattern for user-scoped collection with array fields
- `src/server/payload/collections/Users/index.ts` — Users collection structure, auth pattern
- `src/ui/web/auth/AuthGateModal.tsx` — Existing modal pattern (Dialog + non-dismissible)
- `src/app/api/user-settings/route.ts` — API route pattern (auth check, Zod validation, Payload queries)
- `tests/int/user-progress.int.spec.ts` — Integration test pattern (setup, teardown, access control tests)
- `src/server/payload/access/authenticatedOrOwner.ts` — Access pattern for owner-scoped reads

## Key Signatures
- `adminOnly(args: AccessArgs<User>): boolean` from `src/server/payload/access/adminOnly.ts`
- `authenticated(args: AccessArgs<User>): boolean` from `src/server/payload/access/authenticated.ts`
- `authenticatedOrOwner: Access` from `src/server/payload/access/authenticatedOrOwner.ts`
- `createdByField: Field` from `src/server/payload/fields/createdBy.ts`
- `tenantField: Field` from `src/server/payload/fields/tenant.ts`
- `resolveAccessType(lessonAccessType, courseAccessType): AccessType` from `src/infra/auth/access-types.ts`
- `export const ACCESS_TYPES = ['free', 'mandatory', 'gated'] as const` from `src/infra/auth/access-types.ts`
- `useAccessGate(params): UseAccessGateReturn` from `src/client/hooks/useAccessGate.ts`
- `useCurrentUser(): UseCurrentUserReturn` from `src/client/hooks/useCurrentUser.ts`
- `useTranslations(namespace): t` from `src/ui/web/providers/I18n`
- `AccountRole.Admin, AccountRole.Student` from `src/server/payload/collections/Users/roles.ts`

## Reuse Inventory
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — Use for AccessCodes and CodeRedemptions CUD access
- `authenticated` from `src/server/payload/access/authenticated.ts` — Use for CodeRedemptions create access
- `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts` — Adapt pattern for CodeRedemptions read
- `createdByField` from `src/server/payload/fields/createdBy.ts` — Use in AccessCodes collection
- `tenantField` from `src/server/payload/fields/tenant.ts` — Use in both new collections
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from `src/ui/web/components/dialog` — Use for AccessCodeGateModal
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts` — Use in access code gate state management
- `publishedAndActive` from `src/server/payload/access/publishedAndActive.ts` — NOT reused (different pattern)

## Integration Points
- Must register `AccessCodes` and `CodeRedemptions` in `src/payload.config.ts` collections array (after PricingPlans)
- Must update `ACCESS_TYPES` const in `src/infra/auth/access-types.ts` — all downstream consumers auto-update
- `resolveAccessType` in `src/infra/auth/access-types.ts` auto-handles new type via `ACCESS_TYPES.includes()`
- Lesson page at `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` calls `resolveAccessType` at line 62 and passes result to `AccessGateProvider`
- Must pass `lesson.id` as new prop to `AccessGateProvider` for code redemption checks
- Course page at `src/app/(frontend)/courses/[courseSlug]/page.tsx` also uses `AccessGateProvider` — may need lessonId=undefined handling
- Chapter page at `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` also uses `AccessGateProvider`
- Study page at `src/app/(frontend)/study/_components/StudyContent/index.tsx` uses `AccessGateProvider`
- After schema changes run `pnpm generate:types` to update `src/payload-types.ts`
- After component changes run `pnpm generate:importmap` to update admin import map

## Imports Verified
- `@/server/payload/access/adminOnly` → exports `adminOnly` ✅
- `@/server/payload/access/authenticated` → exports `authenticated` ✅
- `@/server/payload/access/authenticatedOrOwner` → exports `authenticatedOrOwner` ✅
- `@/server/payload/fields/createdBy` → exports `createdByField` ✅
- `@/server/payload/fields/tenant` → exports `tenantField` ✅
- `@/infra/auth/access-types` → exports `ACCESS_TYPES`, `AccessType`, `resolveAccessType` ✅
- `@/server/constants/access-types` → re-exports from `@/infra/auth/access-types` ✅
- `@/ui/web/components/dialog` → exports Dialog, DialogContent, etc. ✅
- `@/client/hooks/useCurrentUser` → exports `useCurrentUser` ✅
- `@/ui/web/providers/I18n` → exports `useTranslations` ✅
- `@/server/payload/collections/Users/roles` → exports `AccountRole` ✅
- `@payload-config` → default export buildConfig ✅
