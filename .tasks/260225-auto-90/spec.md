# Type Safety Fix: Guest Sessions Collection

## Overview

Fix type safety issues in the guest-session.ts service where `'guest-sessions' as any` is used on 7 Payload operations, indicating the collection slug is not properly registered in generated types.

## Files Affected

- `src/server/services/guest-session.ts` — lines 149, 173, 197, 218, 236, 262, 283

## Requirements

1. Run `pnpm generate:types` to regenerate Payload types
2. If the collection is still not in the registry, verify that `GuestSessions` is properly exported and included in `payload.config.ts`
3. Remove all `as any` casts once types are correct

## Acceptance Criteria

- [ ] No `'guest-sessions' as any` casts remain in guest-session.ts
- [ ] TypeScript compilation passes without errors
- [ ] All Payload operations use properly typed collection slugs
