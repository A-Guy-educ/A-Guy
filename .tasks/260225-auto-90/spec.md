# Fix: guest-sessions collection type safety

## Overview
Fix type safety issue in guest-session.ts service where collection slug 'guest-sessions' uses type narrowing (`as const`) on 7 operations. The types are already generated correctly, but unnecessary type casts remain.

## Files Affected
- `src/server/services/guest-session.ts` — lines 150, 178, 201, 222, 239, 265, 286 (as const casts)
- `tests/factories/guest-session.factory.ts` — lines 73, 109 (actual as any casts)

## Requirements
1. Verify GuestSessions collection is properly registered in Payload types (already verified - it IS registered)
2. Remove unnecessary 'as const' casts from guest-session.ts service
3. Optionally: Address 'as any' casts in test factory file
4. Verify type safety after fix

## Implementation Steps
1. ~~Run `pnpm generate:types`~~ - SKIP: Types already generated correctly (GuestSessions in payload-types.ts line 77)
2. Verify GuestSessions is properly exported and included (already verified):
   - ✅ Exported from `src/server/payload/collections/GuestSessions.ts`
   - ✅ Imported in `src/payload.config.ts` (line 40)
   - ✅ Included in collections array (line 146)
   - ✅ Type in `payload-types.ts` (line 77)
3. Remove all 'as const' casts (7 instances) from guest-session.ts - OR determine if they're necessary
4. (Optional) Remove 'as any' casts from test factory

## Acceptance Criteria
- [x] GuestSessions collection appears in payload-types.ts (verified)
- [ ] All 7 instances of unnecessary 'as const' casts evaluated/removed from guest-session.ts
- [ ] TypeScript compilation passes without errors
- [ ] (Optional) 'as any' casts in test factory addressed
