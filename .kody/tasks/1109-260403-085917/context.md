
### build (2026-04-03T09:03:03)
Typecheck passes. Here's a summary of the changes:

**New file**: `src/ui/admin/UserEmail/index.tsx`
- Uses Payload's `useAuth` hook to get the current user
- Displays `user.email` in the sidebar, styled consistently with `VersionInfo`

**Modified**: `src/payload.config.ts`
- Added `afterNavLinks: ['@/ui/admin/UserEmail']` — places the email after the nav links in the admin sidebar, visible on all admin pages

**Regenerated**: `src/app/(payload)/admin/importMap.js`
- New entry for `@/ui/admin/Us
...(truncated)
