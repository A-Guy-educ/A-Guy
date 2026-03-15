# Codebase Context: 260315-auto-791

## Files to Modify
- `src/infra/auth/access-types.ts` (lines 8-14, 32-44) — Add `accessCode` to ACCESS_TYPES and update type
- `src/server/payload/collections/Courses.ts` (lines 147-177) — Add `accessCode` option to accessType and pageAccessType select fields
- `src/server/payload/collections/Lessons.ts` (lines 152-165) — Add `accessCode` option to accessType select field
- `src/payload.config.ts` (lines 1-33 imports, 143-170 collections array) — Import and register AccessCodes + CodeRedemptions
- `src/ui/web/auth/AccessGateProvider.tsx` (lines 20-117) — Add lessonId prop, accessCode modal integration
- `src/client/hooks/useAccessGate.ts` (lines 15-165) — Add accessCode state management, check API call
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (lines 62-186) — Pass lessonId to AccessGateProvider
- `src/i18n/en.json` (line ~323, inside accessControl object) — Add accessCode translation strings
- `src/i18n/he.json` (line ~323, inside accessControl object) — Add accessCode Hebrew translation strings

## Files to Create (NEW)
- `src/server/payload/collections/AccessCodes.ts` — New collection for access codes (lesson-scoped)
- `src/server/payload/collections/CodeRedemptions.ts` — New collection for redemption audit trail
- `src/app/api/access-codes/redeem/route.ts` — POST endpoint for code redemption
- `src/app/api/access-codes/check/route.ts` — GET endpoint for runtime access check
- `src/app/api/access-codes/export/route.ts` — GET endpoint for admin CSV export
- `src/ui/web/auth/AccessCodeGateModal.tsx` — Client component for code entry modal

## Test Files to Create (NEW)
- `tests/unit/access-types.unit.spec.ts` — Unit tests for access type changes
- `tests/unit/i18n-access-code.unit.spec.ts` — Unit tests for i18n completeness
- `tests/int/access-code-gate.int.spec.ts` — Integration tests for collections + field options
- `tests/int/access-code-redeem.int.spec.ts` — Integration tests for redeem + check APIs
- `tests/int/access-code-export.int.spec.ts` — Integration tests for CSV export

## Files to Read (reference patterns)
- `src/ui/web/auth/AuthGateModal.tsx` — Modal pattern (Dialog, non-dismissible, styling)
- `src/ui/web/auth/AccessGateProvider.tsx` — Gate provider integration pattern
- `src/client/hooks/useAccessGate.ts` — Hook pattern for access gate state
- `src/app/api/user-settings/route.ts` — API route pattern (auth via payload.auth, Zod validation, Payload queries)
- `src/server/payload/collections/Courses.ts` — Collection pattern with access control + select fields
- `src/server/payload/collections/Lessons.ts` — Collection pattern with accessType field
- `src/server/payload/access/adminOnly.ts` — Admin access control pattern
- `src/server/payload/access/authenticatedOrOwner.ts` — Owner-scoped access pattern
- `src/server/payload/fields/createdBy.ts` — Reusable field pattern (auto-set createdBy)
- `src/server/payload/fields/tenant.ts` — Reusable tenant field pattern
- `tests/int/lesson-types.int.spec.ts` — Integration test pattern (ensureDefaultTenant, setup hierarchy)

## Key Signatures
- `resolveAccessType(lessonAccessType: string | null | undefined, courseAccessType: string | null | undefined): AccessType` from `src/infra/auth/access-types.ts`
- `export const ACCESS_TYPES = ['free', 'mandatory', 'gated'] as const` from `src/infra/auth/access-types.ts` (will add `'accessCode'`)
- `export const LESSON_ACCESS_TYPES = ['inherit', ...ACCESS_TYPES] as const` from `src/infra/auth/access-types.ts`
- `export const adminOnly: AdminOnlyAccess` from `src/server/payload/access/adminOnly.ts`
- `export const authenticated: isAuthenticated` from `src/server/payload/access/authenticated.ts`
- `export const authenticatedOrOwner: Access` from `src/server/payload/access/authenticatedOrOwner.ts`
- `export const createdByField: Field` from `src/server/payload/fields/createdBy.ts`
- `export const tenantField: Field` from `src/server/payload/fields/tenant.ts`
- `export function useAccessGate(params: UseAccessGateParams): UseAccessGateReturn` from `src/client/hooks/useAccessGate.ts`
- `export function useCurrentUser(): { user, isLoading }` from `src/client/hooks/useCurrentUser.ts`
- `export function AccessGateProvider(props: AccessGateProviderProps)` from `src/ui/web/auth/AccessGateProvider.tsx`
- `export function AuthGateModal(props: AuthGateModalProps)` from `src/ui/web/auth/AuthGateModal.tsx`
- `AccountRole.Admin`, `AccountRole.Student` from `src/server/payload/collections/Users/roles.ts`
- `isUsersCollectionUser(user)` from `src/server/payload/access/isUsersCollectionUser.ts`
- `getDefaultTenantSlug()` from `src/server/repos/tenant/get-default-tenant`

## Reuse Inventory
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — use for CRUD access on AccessCodes + CodeRedemptions
- `authenticated` from `src/server/payload/access/authenticated.ts` — auth check pattern in API routes
- `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts` — CodeRedemptions read access
- `createdByField` from `src/server/payload/fields/createdBy.ts` — use in AccessCodes collection
- `tenantField` from `src/server/payload/fields/tenant.ts` — use in AccessCodes collection
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` from `src/ui/web/components/dialog` — use for AccessCodeGateModal
- `useCurrentUser` from `src/client/hooks/useCurrentUser.ts` — user state in hook
- `useTranslations` from `src/ui/web/providers/I18n` — i18n strings in component
- `AccountRole` from `src/server/payload/collections/Users/roles.ts` — admin role checks
- `isUsersCollectionUser` from `src/server/payload/access/isUsersCollectionUser.ts` — safe user type checking
- `getDefaultTenantSlug` from `src/server/repos/tenant/get-default-tenant` — integration test setup
- `formatSlug` from `src/server/payload/fields/formatSlug` — not needed (codes are admin-defined strings)

## Integration Points
- Must register `AccessCodes` + `CodeRedemptions` in `payload.config.ts` collections array (lines 143-170)
- Must run `pnpm generate:types` after adding collections (before using generated types)
- Must run `pnpm generate:importmap` if adding admin components
- Lesson page at `src/app/(frontend)/courses/.../lessons/[lessonSlug]/page.tsx` uses `resolveAccessType()` → must handle `'accessCode'` return
- `AccessGateProvider` accepts `accessType` prop → must handle `'accessCode'` to show code modal
- `useAccessGate` hook manages modal state → must add `showAccessCodeModal` + check API integration
- Translation strings go in `accessControl` namespace in BOTH `src/i18n/en.json` and `src/i18n/he.json`
- API routes follow Next.js App Router pattern at `src/app/api/access-codes/` directory

## Imports Verified
- `@/server/payload/access/adminOnly` → exports `adminOnly` ✅
- `@/server/payload/access/authenticated` → exports `authenticated` ✅
- `@/server/payload/access/authenticatedOrOwner` → exports `authenticatedOrOwner` ✅
- `@/server/payload/fields/createdBy` → exports `createdByField` ✅
- `@/server/payload/fields/tenant` → exports `tenantField` ✅
- `@/infra/auth/access-types` → exports `ACCESS_TYPES`, `AccessType`, `LESSON_ACCESS_TYPES`, `resolveAccessType` ✅
- `@/ui/web/components/dialog` → exports Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription ✅
- `@/client/hooks/useCurrentUser` → exports `useCurrentUser` ✅
- `@/ui/web/providers/I18n` → exports `useTranslations` ✅
- `@/server/utils/access-gate-server` → exports `isAuthenticatedServer` ✅
- `@/server/payload/collections/Users/roles` → exports `AccountRole` ✅
- `@/server/payload/access/isUsersCollectionUser` → exports `isUsersCollectionUser` ✅
- `@/server/repos/tenant/get-default-tenant` → exports `getDefaultTenantSlug` ✅
