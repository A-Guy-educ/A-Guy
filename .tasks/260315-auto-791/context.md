# Codebase Context: 260315-auto-791

## Files to Modify
- `src/infra/auth/access-types.ts` (lines 8-14, 32-45) — Add `accessCode` to ACCESS_TYPES and update resolveAccessType
- `src/server/payload/collections/Courses.ts` (lines 147-177) — Add `accessCode` option to accessType and pageAccessType select fields
- `src/server/payload/collections/Lessons.ts` (lines 152-165) — Add `accessCode` option to accessType select field
- `src/payload.config.ts` (lines 8-33, 143-170) — Import and register AccessCodes + CodeRedemptions collections
- `src/ui/web/auth/AccessGateProvider.tsx` (lines 20-117) — Add accessCode gate modal integration
- `src/client/hooks/useAccessGate.ts` (lines 34-165) — Add accessCode state management
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (lines 62-80, 107-146) — Pass lessonId to AccessGateProvider, handle accessCode server-side
- `src/i18n/en.json` (line ~323) — Add accessCode translation strings to accessControl namespace
- `src/i18n/he.json` (line ~323) — Add accessCode Hebrew translation strings to accessControl namespace

## Files to Create (NEW)
- `src/server/payload/collections/AccessCodes.ts` — New collection for access codes
- `src/server/payload/collections/CodeRedemptions.ts` — New collection for redemption audit trail
- `src/app/api/access-codes/redeem/route.ts` — POST endpoint for code redemption
- `src/app/api/access-codes/check/route.ts` — GET endpoint for access check
- `src/app/api/access-codes/export/route.ts` — GET endpoint for CSV export
- `src/ui/web/auth/AccessCodeGateModal.tsx` — Client component for code entry popup
- `tests/unit/access-types.unit.spec.ts` — Unit tests for access type changes
- `tests/unit/i18n-access-code.unit.spec.ts` — Unit tests for i18n completeness
- `tests/unit/access-code-gate-modal.unit.spec.ts` — Unit tests for modal component
- `tests/unit/access-gate-provider.unit.spec.ts` — Unit tests for provider integration
- `tests/int/access-code-gate.int.spec.ts` — Integration tests for collections
- `tests/int/access-code-redeem.int.spec.ts` — Integration tests for redemption API
- `tests/int/access-code-export.int.spec.ts` — Integration tests for CSV export

## Files to Read (reference patterns)
- `src/ui/web/auth/AuthGateModal.tsx` — Modal pattern to follow (Dialog, non-dismissible, styling)
- `src/ui/web/auth/AccessGateProvider.tsx` — Gate provider integration pattern
- `src/client/hooks/useAccessGate.ts` — Hook pattern for access gate state
- `src/app/api/user-settings/route.ts` — API route pattern (auth check, Zod validation, Payload queries)
- `src/server/payload/collections/Users/index.ts` — Collection pattern with RBAC access
- `src/server/payload/access/adminOnly.ts` — Access control pattern
- `src/server/payload/access/authenticated.ts` — Authenticated access pattern
- `src/server/payload/access/authenticatedOrOwner.ts` — Owner-scoped access pattern
- `src/server/payload/fields/createdBy.ts` — Reusable field pattern
- `tests/int/lesson-types.int.spec.ts` — Integration test pattern (setup, tenant, course, chapter)

## Key Signatures
- `resolveAccessType(lessonAccessType: string | null | undefined, courseAccessType: string | null | undefined): AccessType` from `src/infra/auth/access-types.ts`
- `export const ACCESS_TYPES = ['free', 'mandatory', 'gated'] as const` from `src/infra/auth/access-types.ts`
- `export const LESSON_ACCESS_TYPES = ['inherit', ...ACCESS_TYPES] as const` from `src/infra/auth/access-types.ts`
- `export const adminOnly: AdminOnlyAccess` from `src/server/payload/access/adminOnly.ts`
- `export const authenticated: isAuthenticated` from `src/server/payload/access/authenticated.ts`
- `export const createdByField: Field` from `src/server/payload/fields/createdBy.ts`
- `export const tenantField: Field` from `src/server/payload/fields/tenant.ts`
- `export function useAccessGate(params): UseAccessGateReturn` from `src/client/hooks/useAccessGate.ts`
- `export function useCurrentUser(): UseCurrentUserReturn` from `src/client/hooks/useCurrentUser.ts`
- `export async function isAuthenticatedServer(): Promise<boolean>` from `src/server/utils/access-gate-server.ts`
- `export function AccessGateProvider(props: AccessGateProviderProps)` from `src/ui/web/auth/AccessGateProvider.tsx`
- `export function AuthGateModal(props: AuthGateModalProps)` from `src/ui/web/auth/AuthGateModal.tsx`
- `AccountRole.Admin`, `AccountRole.Student` from `src/server/payload/collections/Users/roles.ts`
- `isUsersCollectionUser(user)` from `src/server/payload/access/isUsersCollectionUser.ts`

## Reuse Inventory
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — use for CRUD access on AccessCodes and CodeRedemptions
- `authenticated` from `src/server/payload/access/authenticated.ts` — use for redemption endpoint auth check pattern
- `createdByField` from `src/server/payload/fields/createdBy.ts` — use in AccessCodes collection
- `tenantField` from `src/server/payload/fields/tenant.ts` — use in AccessCodes collection
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from `src/ui/web/components/dialog` — use for AccessCodeGateModal
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts` — use in access code gate hooks
- `useTranslations` from `src/ui/web/providers/I18n` — use for all new UI strings
- `AccountRole` from `src/server/payload/collections/Users/roles.ts` — admin role checks
- `isUsersCollectionUser` from `src/server/payload/access/isUsersCollectionUser.ts` — safe user type checking
- `getDefaultTenantSlug` from `src/server/repos/tenant/get-default-tenant` — use in integration tests

## Integration Points
- Must register AccessCodes + CodeRedemptions in `payload.config.ts` collections array (lines 143-170)
- Must run `pnpm generate:types` after adding collections (regenerates `src/payload-types.ts`)
- Must run `pnpm generate:importmap` if adding admin components
- Lesson page at `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` uses `resolveAccessType()` and wraps content with `AccessGateProvider`
- `AccessGateProvider` is used in 4 page files (lesson, chapter, course pages + study content)
- Translation strings must be added to BOTH `src/i18n/en.json` and `src/i18n/he.json` in `accessControl` namespace
- API routes follow Next.js App Router pattern at `src/app/api/` directory

## Imports Verified
- `@/server/payload/access/adminOnly` → exports `adminOnly` ✅
- `@/server/payload/access/authenticated` → exports `authenticated` ✅
- `@/server/payload/access/authenticatedOrOwner` → exports `authenticatedOrOwner` ✅
- `@/server/payload/fields/createdBy` → exports `createdByField` ✅
- `@/server/payload/fields/tenant` → exports `tenantField` ✅
- `@/infra/auth/access-types` → exports `ACCESS_TYPES`, `AccessType`, `LESSON_ACCESS_TYPES`, `resolveAccessType` ✅
- `@/ui/web/components/dialog` → exports Dialog, DialogContent, etc. ✅
- `@/client/hooks/useCurrentUser` → exports `useCurrentUser` ✅
- `@/ui/web/providers/I18n` → exports `useTranslations` ✅
- `@/server/utils/access-gate-server` → exports `isAuthenticatedServer` ✅
