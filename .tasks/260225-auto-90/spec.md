# Fix: Guest-sessions Collection Type Registry Issue

## Overview
Fix type safety issue in `guest-session.ts` service where `'guest-sessions' as any` is used 7 times, indicating the collection slug is not properly registered in generated Payload types.

## Requirements

### FR-1: Regenerate Payload Types
- Run `pnpm generate:types` to regenerate Payload types from collection configurations
- Verify GuestSessions collection is included in generated types

### FR-2: Verify Collection Registration
- If collection is still missing after type generation, verify GuestSessions is properly exported
- Check that GuestSessions is included in payload.config.ts collections array

### FR-3: Remove Type Casts
- Remove all 7 instances of `as any` cast from `src/server/services/guest-session.ts`
- Lines: 149, 173, 197, 218, 236, 262, 283

## Acceptance Criteria

1. `pnpm generate:types` completes without errors
2. All `as any` casts removed from guest-session.ts
3. TypeScript compilation passes with no type errors related to guest-sessions collection
4. Service functionality remains unchanged (code works, just fixing type safety)
