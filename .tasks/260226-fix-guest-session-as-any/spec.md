# Fix: Guest Sessions Type Safety

## Overview
Fix type safety issue in `guest-session.ts` service where `'guest-sessions' as any` is used 7 times, indicating the collection slug is not in the generated type registry.

## Files Affected
- `src/server/services/guest-session.ts` — lines 149, 173, 197, 218, 236, 262, 283

## Requirements

### FR-1: Regenerate Payload Types
Run `pnpm generate:types` to regenerate Payload types and register the guest-sessions collection.

### FR-2: Verify Collection Registration
If the collection is still not in the registry after type generation:
- Check that `GuestSessions` collection is properly exported from collections index
- Verify `GuestSessions` is included in `payload.config.ts` collections array

### FR-3: Remove Type Casts
Remove all 7 occurrences of `'as any'` cast from the guest-session.ts service file once proper types are available.

## Acceptance Criteria

- [ ] `pnpm generate:types` completes without errors
- [ ] GuestSessions collection appears in generated payload-types.ts
- [ ] All 7 `as any` casts removed from `src/server/services/guest-session.ts`
- [ ] TypeScript compilation passes (`pnpm tsc --noEmit`)
- [ ] Application runtime behavior unchanged (types only)
