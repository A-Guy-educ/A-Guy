# Fix: guest-sessions collection type registry

## Overview
Fix type safety issue in guest-session.ts service where collection slug 'guest-sessions' is cast as `any` on 7 operations, indicating the collection is not in the generated Payload types.

## Files Affected
- `src/server/services/guest-session.ts` — lines 149, 173, 197, 218, 236, 262, 283

## Requirements
1. Ensure GuestSessions collection is properly registered in Payload types
2. Remove all `as any` casts from guest-session.ts service
3. Verify type safety after fix

## Implementation Steps
1. Run `pnpm generate:types` to regenerate Payload types
2. If collection still not in registry, verify GuestSessions is:
   - Properly exported from collections
   - Included in payload.config.ts
3. Remove all `as any` casts (7 instances) from guest-session.ts

## Acceptance Criteria
- [ ] `pnpm generate:types` completes successfully
- [ ] GuestSessions collection appears in payload-types.ts
- [ ] All 7 instances of `as any` removed from guest-session.ts
- [ ] TypeScript compilation passes without errors
