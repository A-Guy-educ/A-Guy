
### taskify (2026-04-06T10:12:16)
The fix is complete. TypeScript compiles cleanly.

## Summary

**Problem**: Login flow in `UserIdentificationTracker.tsx` only called `identify()` without `alias()`, causing Mixpanel to create separate anonymous and identified profiles instead of merging them.

**Fix**: Added `alias(user.id)` call before `identify(user.id, userProperties)` at line 109 in `UserIdentificationTracker.tsx`.

**Why this works**: 
- The `aliasUser()` function in the adapter already guards against duplicate alias calls
...(truncated)

### build (2026-04-06T10:21:55)
The fix is complete. Here's what was changed:

**File modified**: `src/infra/analytics/components/UserIdentificationTracker.tsx`

**Changes**:
1. Added import for `getOrCreateAnonymousId` from `../utils/anonymous-id`
2. Changed `alias(user.id)` to `alias(user.id, getOrCreateAnonymousId())` at line 110

**Why this fixes the issue**:
- Mixpanel's `alias()` function requires both the `userId` and `anonymousId` (from the `mp_anon_id` cookie) to properly merge an anonymous session with an identified 
...(truncated)
