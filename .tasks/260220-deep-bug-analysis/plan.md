# Deep Bug Analysis — Implementation Plan

**Task**: Fix all critical and high-severity bugs identified across the codebase
**Date**: 2026-02-20
**Estimated Total**: ~8-10 hours across 11 steps

---

## Step 1: Lock Down 7 Collections — CUD Access Control (CRITICAL #1)

**Files to touch**:
- `src/server/payload/collections/Categories.ts` (MODIFIED, lines 10-15)
- `src/server/payload/collections/Chapters.ts` (MODIFIED, lines 17-22)
- `src/server/payload/collections/Courses.ts` (MODIFIED, lines 26-31)
- `src/server/payload/collections/Lessons.ts` (MODIFIED, lines 16-21)
- `src/server/payload/collections/PricingPlans.ts` (MODIFIED, lines 9-14)
- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED, lines 8-13)
- `src/server/payload/collections/Media/index.ts` (MODIFIED, lines 23-28)
- `tests/int/access-control-lockdown.int.spec.ts` (NEW)

**Behavior**:
- Change `create`, `update`, `delete` access from `authenticated` to `adminOnly` on all 7 collections
- Keep `read: anyone` (or existing read access) unchanged
- Import `adminOnly` from `src/server/payload/access/adminOnly.ts` (already exists)

**Tests** (integration — FAIL before, PASS after):
1. `test('student user CANNOT create a course via Local API with overrideAccess: false')` — attempts `payload.create({ collection: 'courses', data: { title: 'Test' }, user: studentUser, overrideAccess: false })`, expects rejection/forbidden
2. `test('admin user CAN create a course via Local API with overrideAccess: false')` — same call with admin user, expects success

**Acceptance Criteria**:
- [ ] All 7 collections have `create: adminOnly`, `update: adminOnly`, `delete: adminOnly`
- [ ] `read` access unchanged on all collections
- [ ] Integration test confirms student cannot CUD, admin can CUD
- [ ] `pnpm tsc --noEmit` passes

---

## Step 2: Fix Exercise Hooks — Transaction Safety (CRITICAL #2)

**Files to touch**:
- `src/server/payload/collections/Exercises/hooks.ts` (MODIFIED, lines 1-90)
- `tests/int/exercise-hooks-transaction.int.spec.ts` (NEW)

**Behavior**:
- Remove `getPayloadInstance()` helper function entirely
- Modify `generateSlug` field hook to use `req.payload` from hook args and pass `req` to `.find()` calls
- Modify `validateSlugUniqueness` field hook to use `req.payload` from hook args and pass `req` to `.find()` calls
- Field hooks receive `{ req, data, value, siblingData, operation }` — use `req.payload` for all DB operations

**Tests** (integration — FAIL before, PASS after):
1. `test('exercise slug is auto-generated from title using req.payload')` — create exercise with title, verify slug is generated correctly
2. `test('duplicate exercise slugs within same lesson get suffixed')` — create two exercises with same title in same lesson, verify second gets `-1` suffix

**Acceptance Criteria**:
- [ ] No `getPayloadInstance()` function exists in the file
- [ ] All `.find()` calls pass `req` parameter
- [ ] All DB operations use `req.payload` not standalone instance
- [ ] Slugs still generate and deduplicate correctly
- [ ] `pnpm tsc --noEmit` passes

---

## Step 3: Fix `preventLastAdminDemotion` — Override Access (CRITICAL #3)

**Files to touch**:
- `src/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook.ts` (MODIFIED, line 22-29)
- `tests/int/prevent-last-admin-demotion.int.spec.ts` (NEW)

**Behavior**:
- Change `overrideAccess: false` to `overrideAccess: true` in the `payload.count()` call
- This ensures the hook sees ALL admin users regardless of who triggered the operation

**Tests** (integration — FAIL before, PASS after):
1. `test('cannot demote the last admin user')` — create single admin, attempt to update role to 'student', expect error/rejection
2. `test('can demote an admin when other admins exist')` — create two admins, demote one, expect success

**Acceptance Criteria**:
- [ ] `overrideAccess: true` in the count query
- [ ] Last admin cannot be demoted
- [ ] Non-last admin can be demoted
- [ ] `pnpm tsc --noEmit` passes

---

## Step 4: Lock Down GuestSessions Create Access (CRITICAL #4)

**Files to touch**:
- `src/server/payload/collections/GuestSessions.ts` (MODIFIED, line 38)
- `src/server/services/guest-session.ts` (MODIFIED — verify `overrideAccess: true` is explicit)
- `tests/int/guest-sessions-access.int.spec.ts` (NEW)

**Behavior**:
- Change `create: () => true` to `create: () => false` on GuestSessions collection
- Ensure the `createGuestSession` service function explicitly sets `overrideAccess: true` (it currently relies on the default)
- Also change `read: () => false` to `read: adminOnly` so admins can debug sessions

**Tests** (integration — FAIL before, PASS after):
1. `test('unauthenticated user CANNOT create guest session via overrideAccess: false')` — attempts direct creation with `overrideAccess: false`, expects rejection
2. `test('guest session service CAN create sessions with overrideAccess: true')` — calls service function, expects success

**Acceptance Criteria**:
- [ ] `create: () => false` on GuestSessions
- [ ] `read: adminOnly` on GuestSessions (admin debugging)
- [ ] Service explicitly passes `overrideAccess: true`
- [ ] Guest session creation still works via the service
- [ ] `pnpm tsc --noEmit` passes

---

## Step 5: Fix `ensureRoleOnSignup` — Allow Admin-Created Users (CRITICAL #5)

**Files to touch**:
- `src/server/payload/collections/Users/hooks/ensureRoleOnSignup-hook.ts` (MODIFIED, lines 1-15)
- `tests/int/ensure-role-on-signup.int.spec.ts` (NEW)

**Behavior**:
- Change hook to accept `req` from hook args
- Only force `AccountRole.Student` when `operation === 'create'` AND the requesting user is NOT an admin
- If `req.user?.role === AccountRole.Admin`, preserve the provided value

**Tests** (integration — FAIL before, PASS after):
1. `test('public signup always gets student role')` — create user without admin context, expect role = 'student'
2. `test('admin-created user preserves assigned role')` — admin creates user with role 'admin', expect role = 'admin'

**Acceptance Criteria**:
- [ ] Public signups still get forced to 'student'
- [ ] Admin-created users keep the assigned role
- [ ] `pnpm tsc --noEmit` passes

---

## Step 6: Fix ExerciseAssets — Remove `staticDir` (CRITICAL #6)

**Files to touch**:
- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED, line 15)
- `src/server/payload/plugins/index.ts` (MODIFIED — verify exercise-assets in Vercel Blob config)

**Behavior**:
- Remove `staticDir: 'exercise-assets'` from upload config
- Verify `exercise-assets` collection is registered in the Vercel Blob storage plugin
- If not, add it to the blob plugin's `collections` array

**Tests** (integration — FAIL before, PASS after):
1. `test('ExerciseAssets collection config has no staticDir property')` — import collection config, assert `upload.staticDir` is undefined
2. `test('ExerciseAssets is registered in blob storage plugin')` — verify plugin config includes the collection

**Acceptance Criteria**:
- [ ] No `staticDir` in ExerciseAssets config
- [ ] Collection registered in Vercel Blob plugin
- [ ] `pnpm tsc --noEmit` passes

---

## Step 7: Add Auth + Validation to `chapters/by-grade` API Route (HIGH #7)

**Files to touch**:
- `src/app/api/chapters/by-grade/route.ts` (MODIFIED, lines 7-82)
- `tests/int/chapters-by-grade-api.int.spec.ts` (NEW)

**Behavior**:
- Add authentication check: `const { user } = await payload.auth({ headers: req.headers })`
- Return 401 if no user
- Add Zod validation for `grade` query parameter (e.g., `z.string().min(1)`)
- Add explicit `overrideAccess: false` and `user` to `payload.find()` calls
- Return 400 for invalid grade parameter

**Tests** (integration — FAIL before, PASS after):
1. `test('returns 401 for unauthenticated requests')` — GET without auth header, expect 401
2. `test('returns 400 for missing grade parameter')` — authenticated GET without grade param, expect 400

**Acceptance Criteria**:
- [ ] Endpoint requires authentication (401 without)
- [ ] Grade parameter validated with Zod (400 if invalid)
- [ ] `overrideAccess: false` + `user` passed to Payload queries
- [ ] `pnpm tsc --noEmit` passes

---

## Step 8: Fix ConversationService — Access Control + Transaction Safety (HIGH #8)

**Files to touch**:
- `src/server/services/conversation-service.ts` (MODIFIED, multiple methods)
- `tests/int/conversation-service-access.int.spec.ts` (NEW)

**Behavior**:
- Add `req` parameter to constructor or method signatures
- For user-facing operations (find user conversations, create conversation, reset conversation):
  - Pass `user` and `overrideAccess: false` to enforce ownership
- For system operations (memory management, context building):
  - Explicitly pass `overrideAccess: true` with comment `// System operation: intentional bypass`
- Pass `req` to all nested `payload.create()` and `payload.update()` calls for transaction safety

**Tests** (integration — FAIL before, PASS after):
1. `test('user cannot read another user conversations with overrideAccess: false')` — user A tries to find user B's conversations, expects empty results
2. `test('conversation create enforces user ownership')` — create conversation, verify user field matches req.user.id

**Acceptance Criteria**:
- [ ] All user-facing operations use `overrideAccess: false` + `user`
- [ ] All system operations explicitly set `overrideAccess: true` with comment
- [ ] `req` passed to all nested Payload operations
- [ ] `pnpm tsc --noEmit` passes

---

## Step 9: Fix Guest Session Race Conditions (HIGH #9, #10)

**Files to touch**:
- `src/server/services/guest-session.ts` (MODIFIED, lines 255-296)
- `src/server/services/guest-session-upgrade.ts` (MODIFIED, lines 53-63)
- `tests/int/guest-session-race-condition.int.spec.ts` (NEW)

**Behavior**:
- **Message count**: Replace read-then-increment with atomic update using `where` clause:
  ```
  payload.update({ where: { id: { equals: sessionId }, messageCount: { less_than: maxMessages } }, data: { messageCount: currentCount + 1 } })
  ```
  If `totalDocs === 0`, limit exceeded
- **Conversation claim**: Replace loop with batch update:
  ```
  payload.update({ collection: 'conversations', where: { guestSession: { equals: sessionId } }, data: { user: userId, guestSession: null } })
  ```
- Add `req` parameter to all Payload operations in both files

**Tests** (integration — FAIL before, PASS after):
1. `test('message count increment is atomic — cannot exceed limit')` — set messageCount to max-1, call twice, verify only one succeeds
2. `test('conversation claim uses batch update, not loop')` — claim multiple conversations, verify all transfer atomically

**Acceptance Criteria**:
- [ ] No read-then-write pattern for message counting
- [ ] Conversation claim uses batch update (no for loop)
- [ ] `req` passed to all operations
- [ ] `pnpm tsc --noEmit` passes

---

## Step 10: Fix LLM Response Parsing + Unstable Callbacks (HIGH #11, #12)

**Files to touch**:
- `src/infra/llm/services/answer-validation-service.ts` (MODIFIED, line ~90)
- `src/ui/web/chat/hooks/useNotebookChat.ts` (MODIFIED, line ~446)
- `tests/int/answer-validation-parse.int.spec.ts` (NEW)

**Behavior**:
- **`parseLLMResponse`**: Wrap `JSON.parse(cleaned)` in try/catch, return `{ isCorrect: false, reasoning: 'Failed to parse LLM response' }` on failure
- **`streamMessage`**: Wrap in `useCallback` with proper dependencies, or convert to a ref-based pattern to prevent infinite re-renders

**Tests** (unit — FAIL before, PASS after):
1. `test('parseLLMResponse handles malformed JSON gracefully')` — pass `"not json {{"`, expect `{ isCorrect: false }` instead of throw
2. `test('parseLLMResponse handles valid JSON correctly')` — pass valid response, expect parsed result

**Acceptance Criteria**:
- [ ] `JSON.parse` wrapped in try/catch with graceful fallback
- [ ] `streamMessage` is stable (memoized or ref-based)
- [ ] No unhandled exceptions from LLM output parsing
- [ ] `pnpm tsc --noEmit` passes

---

## Step 11: Miscellaneous HIGH Fixes (Cleanup Batch)

**Files to touch**:
- `src/server/payload/collections/Chapters.ts` (MODIFIED, line 26) — remove `console.log`
- `src/payload.config.ts` (MODIFIED, line ~186) — restrict job access to admin
- `src/server/services/conversation-service.ts` (MODIFIED, lines 283-326) — add TODO comment to `validateContextAccess`
- `src/server/payload/collections/ExerciseAssets.ts` (MODIFIED, line 37) — remove invalid `adminThumbnail`
- `src/server/payload/collections/Conversations.ts` (MODIFIED, lines 40, 86) — remove `as any` casts

**Behavior**:
- Remove `console.log('data:', data)` from Chapters beforeChange hook
- Change job access from `if (req.user) return true` to `if (req.user?.role === 'admin') return true`
- Add explicit `// TODO(security): Implement enrollment-based access. Currently open to all authenticated users.` comment
- Remove `adminThumbnail: 'thumbnail'` (references nonexistent image size)
- Fix `as any` type assertions in Conversations with proper types

**Tests** (integration — FAIL before, PASS after):
1. `test('non-admin user cannot run jobs')` — student user attempts job execution, expect rejection
2. `test('admin user can run jobs')` — admin user attempts job execution, expect success

**Acceptance Criteria**:
- [ ] No `console.log` in Chapters hook
- [ ] Job access restricted to admins
- [ ] `validateContextAccess` has clear TODO comment
- [ ] No invalid `adminThumbnail` reference
- [ ] `as any` removed from Conversations where possible
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes

---

## Summary

| Step | Severity | Est. Time | Description |
|------|----------|-----------|-------------|
| 1 | CRITICAL | 30 min | Lock down 7 collections CUD access |
| 2 | CRITICAL | 45 min | Fix Exercise hooks transaction safety |
| 3 | CRITICAL | 20 min | Fix admin demotion override access |
| 4 | CRITICAL | 25 min | Lock down GuestSessions create |
| 5 | CRITICAL | 20 min | Fix ensureRoleOnSignup for admin creates |
| 6 | CRITICAL | 15 min | Remove staticDir from ExerciseAssets |
| 7 | HIGH | 30 min | Add auth to chapters/by-grade route |
| 8 | HIGH | 60 min | Fix ConversationService access + transactions |
| 9 | HIGH | 45 min | Fix guest session race conditions |
| 10 | HIGH | 30 min | Fix LLM parsing + unstable callbacks |
| 11 | HIGH | 30 min | Miscellaneous HIGH fixes batch |

**Total estimated**: ~5.5 hours

**Post-completion gates**:
- `pnpm tsc --noEmit` — zero errors
- `pnpm lint` — zero errors
- `pnpm test:int` — all tests pass
- `pnpm generate:types` — types regenerated
