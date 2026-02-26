# Fix: Guest Sessions Type Safety

## Overview
Fix type safety issue in `guest-session.ts` service where `'guest-sessions'` collection slug is cast as `any` in 7 places, indicating the collection is not properly registered in Payload's generated types.

## Requirements
1. Run `pnpm generate:types` to regenerate Payload types
2. If collection is still not in registry, verify `GuestSessions` is properly exported and included in `payload.config.ts`
3. Remove all `as any` casts from the service file

## Files Affected
- `src/server/services/guest-session.ts` — lines 149, 173, 197, 218, 236, 262, 283

## Acceptance Criteria
- [ ] Run `pnpm generate:types` successfully completes
- [ ] All 7 occurrences of `'guest-sessions' as any` are removed
- [ ] TypeScript compilation passes without errors
- [ ] Service functions work correctly at runtime (verify via tests if available)
