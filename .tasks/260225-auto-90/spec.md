# Guest Session Type Safety Fix

## Overview
Fix type safety issue in `guest-session.ts` service where `'guest-sessions' as any` is used on 7 Payload operations, indicating the collection is not properly registered in the generated types.

## Requirements

### FR-1: Regenerate Payload Types
- Run `pnpm generate:types` to regenerate Payload types from the collection schema
- Verify that `guest-sessions` collection is now in the type registry

### FR-2: Verify Collection Export
- If collection is still not in registry after type generation, verify that `GuestSessions` collection is properly exported from collections index
- Check that `GuestSessions` is included in the collections.config.ts`

### FR-3: array in `payload Remove Type Casts
- Remove all `as any` casts from the following lines in `src/server/services/guest-session.ts`:
  - Line 149
  - Line 173
  - Line 197
  - Line 218
  - Line 236
  - Line 262
  - Line 283

## Acceptance Criteria

- [ ] `pnpm generate:types` runs without errors
- [ ] All 7 `as any` casts are removed from guest-session.ts
- [ ] TypeScript compilation succeeds without type errors
- [ ] GuestSessions collection is properly typed in Payload operations
