# Task

## Description
The `guest-session.ts` service uses `'guest-sessions' as any` on 7 Payload operations, suggesting the collection slug is not properly registered in the generated types.

## Files Affected
- `src/server/services/guest-session.ts` — lines 149, 173, 197, 218, 236, 262, 283

## Expected Fix
1. Run `pnpm generate:types` to regenerate Payload types
2. If the collection is still not in the registry, check that `GuestSessions` is properly exported and included in `payload.config.ts`
3. Remove all `as any` casts once types are correct

## Priority
LOW — Type safety issue, code works but bypasses type checking
