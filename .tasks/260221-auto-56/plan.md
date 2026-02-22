# Plan: 260221-auto-56 — Add Error Logging to Swallowed Catch Blocks

## Summary

Four files across the codebase have catch blocks that silently discard errors (using `_error` / `_err` variable names, never logging them). This makes debugging production issues nearly impossible. The fix is strictly additive: rename the unused error variables to `error`/`err`, add `console.error(...)` with descriptive prefixes, and keep all existing behavior (return values, state updates, toasts) unchanged.

## Assumptions

- `console.error` is the standard logging mechanism for these files (spec explicitly says no Pino/Sentry).
- The `api-service.ts` file already imports `logger` from `@/infra/utils/logger`, but the spec requires `console.error` — we'll use `console.error` as specified.
- The `useNotebookChat.ts` file already uses `logger` in some catch blocks but not in three specific ones (lines 519, 574, 602) — those need `console.error` added.
- Tests use `vi.spyOn(console, 'error')` to verify logging without suppressing output.

---

## Step 1: Add Error Logging in exercises.ts Catch Block

**Time estimate**: 10 minutes

**Spec requirement**: FR-001

**Root Cause**: The `queryExerciseById` function (line 35) catches errors with `_error` and returns `null` without any logging, making it impossible to distinguish "not found" from "database error".

**Files to Touch**:
- `src/server/repos/queries/exercises.ts` (MODIFIED - lines 35-37)

**Current code** (lines 35-37):
```typescript
} catch (_error) {
  return null
}
```

**Fix**: Rename `_error` → `error`, add `console.error('Failed to query exercise by ID:', error)` before `return null`.

**Expected code after fix**:
```typescript
} catch (error) {
  console.error('Failed to query exercise by ID:', error)
  return null
}
```

**Reproduction Test** (update existing test file):
- Test location: `tests/unit/queries/exercises.test.ts`
- Add a new test: `'logs error to console when findByID throws'`
- Setup: `vi.spyOn(console, 'error').mockImplementation(() => {})`, mock `findByID` to reject
- Why it fails now: `console.error` is never called — the error is silently swallowed
- After fix: `console.error` is called with `'Failed to query exercise by ID:'` and the error object

**Tests that FAIL before, PASS after**:
1. `queryExerciseById > logs error to console when findByID throws` — asserts `console.error` was called with descriptive prefix and original error
2. Existing test `returns null when exercise not found` — MUST STILL PASS (no regression)

**Acceptance Criteria**:
- [ ] Variable renamed from `_error` to `error`
- [ ] `console.error('Failed to query exercise by ID:', error)` added before `return null`
- [ ] Function still returns `null` on error (no behavioral change)
- [ ] New test verifies `console.error` is called with correct args
- [ ] Existing tests still pass

---

## Step 2: Add Error Logging in api-service.ts Catch Blocks (3 locations)

**Time estimate**: 15 minutes

**Spec requirement**: FR-002

**Root Cause**: Three methods (`chat`, `getConversation`, `resetChat`) catch errors with `_error` and return generic `{ success: false, error: 'Network error' }` without logging the actual error.

**Files to Touch**:
- `src/server/services/api/api-service.ts` (MODIFIED - lines 123, 197, 235)
- `tests/unit/services/api-service.test.ts` (NEW)

### Fix details for each catch block:

**Location 1 — `chat()` method (line 123)**:
```typescript
// Before:
} catch (_error) {
  return { success: false, error: 'Network error' }
}
// After:
} catch (error) {
  console.error('Chat API request failed:', error)
  return { success: false, error: 'Network error' }
}
```

**Location 2 — `getConversation()` method (line 197)**:
```typescript
// Before:
} catch (_error) {
  return { success: false, exists: false, messages: [], error: 'Network error' }
}
// After:
} catch (error) {
  console.error('Get conversation API request failed:', error)
  return { success: false, exists: false, messages: [], error: 'Network error' }
}
```

**Location 3 — `resetChat()` method (line 235)**:
```typescript
// Before:
} catch (_error) {
  return { success: false, error: 'Network error' }
}
// After:
} catch (error) {
  console.error('Reset chat API request failed:', error)
  return { success: false, error: 'Network error' }
}
```

**Reproduction Test**:
- Test location: `tests/unit/services/api-service.test.ts` (NEW)
- Mock `global.fetch` to throw `new Error('Network failure')`
- Three tests: one per method, each verifies `console.error` is called with descriptive prefix
- Why they fail now: `console.error` is never called in any of the three catch blocks

**Tests that FAIL before, PASS after**:
1. `apiService.chat > logs error to console on network failure` — asserts `console.error` called with `'Chat API request failed:'` and the error
2. `apiService.getConversation > logs error to console on network failure` — asserts `console.error` called with `'Get conversation API request failed:'` and the error
3. `apiService.resetChat > logs error to console on network failure` — asserts `console.error` called with `'Reset chat API request failed:'` and the error
4. Each test also verifies the return value is still the same generic failure response (no regression)

**Acceptance Criteria**:
- [ ] All three `_error` variables renamed to `error`
- [ ] Each catch block has `console.error` with a unique descriptive prefix
- [ ] Return values remain identical (`{ success: false, error: 'Network error' }` etc.)
- [ ] New tests verify all three logging calls
- [ ] Return values verified in tests (no behavioral regression)

---

## Step 3: Add Error Logging in useNotebookChat.ts Catch Blocks (3 locations)

**Time estimate**: 15 minutes

**Spec requirement**: FR-003

**Root Cause**: Three catch blocks in `streamMessage` (line 519), `sendMessageSync` (line 574), and `handleReset` (line 602) use `_error` and show `toast.error()` without logging the actual error to console.

**Files to Touch**:
- `src/ui/web/chat/hooks/useNotebookChat.ts` (MODIFIED - lines 519, 574, 602)
- `tests/unit/hooks/useNotebookChat.test.ts` (MODIFIED — add 3 test cases)

### Fix details for each catch block:

**Location 1 — `streamMessage` callback (line 519)**:
```typescript
// Before:
} catch (_error) {
  toast.error(errorMessage)
}
// After:
} catch (error) {
  console.error('Stream message failed:', error)
  toast.error(errorMessage)
}
```

**Location 2 — `sendMessageSync` function (line 574)**:
```typescript
// Before:
} catch (_error) {
  toast.error(errorMessage)
}
// After:
} catch (error) {
  console.error('Send message sync failed:', error)
  toast.error(errorMessage)
}
```

**Location 3 — `handleReset` callback (line 602)**:
```typescript
// Before:
} catch (_error) {
  toast.error(resetErrorMessage)
}
// After:
} catch (error) {
  console.error('Chat reset failed:', error)
  toast.error(resetErrorMessage)
}
```

**Reproduction Test** (add to existing test file):
- Test location: `tests/unit/hooks/useNotebookChat.test.ts` (MODIFIED)
- Mock `console.error` via `vi.spyOn(console, 'error').mockImplementation(() => {})`
- Three new tests verify `console.error` is called when errors occur in each path

**Tests that FAIL before, PASS after**:
1. `useNotebookChat > logs error to console when streaming fails` — mock `apiService.chatStream` to throw, verify `console.error` called with `'Stream message failed:'`
2. `useNotebookChat > logs error to console when sync message fails` — mock `apiService.chat` to throw, use `adminMode: true` to force sync path, verify `console.error` called with `'Send message sync failed:'`
3. `useNotebookChat > logs error to console when reset fails` — mock `apiService.resetChat` to throw, verify `console.error` called with `'Chat reset failed:'`
4. All three tests also verify the toast is still shown (no regression)

**Acceptance Criteria**:
- [ ] All three `_error` variables renamed to `error`
- [ ] Each catch block has `console.error` with a unique descriptive prefix before the toast call
- [ ] `toast.error()` calls remain unchanged
- [ ] New tests verify all three console.error calls with correct arguments
- [ ] Existing tests still pass (toast behavior unchanged)

---

## Step 4: Add Error Logging in ConvertForm/index.tsx Catch Block

**Time estimate**: 10 minutes

**Spec requirement**: FR-004

**Root Cause**: The `handleSubmit` function (line 84) catches errors with `_err` and sets generic error state without logging the actual error.

**Files to Touch**:
- `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` (MODIFIED - line 84)
- `tests/unit/admin/exercise-conversion/ConvertForm.test.tsx` (NEW)

**Current code** (lines 84-85):
```typescript
} catch (_err) {
  setError('Queue failed')
}
```

**Fix**: Rename `_err` → `err`, add `console.error('Exercise conversion queue failed:', err)` before `setError`.

**Expected code after fix**:
```typescript
} catch (err) {
  console.error('Exercise conversion queue failed:', err)
  setError('Queue failed')
}
```

**Reproduction Test**:
- Test location: `tests/unit/admin/exercise-conversion/ConvertForm.test.tsx` (NEW)
- Render `ConvertForm` with mock props
- Mock `global.fetch` for prompt-loading (success) then mock the submit fetch to throw
- Trigger the submit button click
- Assert `console.error` was called with `'Exercise conversion queue failed:'` and the error
- Assert the error text 'Queue failed' is visible in the DOM

**Tests that FAIL before, PASS after**:
1. `ConvertForm > logs error to console when queue submission throws` — asserts `console.error` called with prefix and error object
2. Same test also verifies `'Queue failed'` error message is rendered (no regression in user-facing behavior)

**Acceptance Criteria**:
- [ ] Variable renamed from `_err` to `err`
- [ ] `console.error('Exercise conversion queue failed:', err)` added before `setError('Queue failed')`
- [ ] `setError('Queue failed')` still called (no behavioral change)
- [ ] New test verifies `console.error` call with correct arguments
- [ ] Error state still rendered in UI

---

## Quality Gates

After all steps:
1. Run `pnpm tsc --noEmit` — must pass (no type errors from renamed variables)
2. Run `pnpm test:unit -- --run tests/unit/queries/exercises.test.ts tests/unit/services/api-service.test.ts tests/unit/hooks/useNotebookChat.test.ts tests/unit/admin/exercise-conversion/ConvertForm.test.tsx` — all tests pass
3. Run `pnpm lint` — no new lint warnings (variables are now used, no unused-var warnings)

## File Change Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/server/repos/queries/exercises.ts` | MODIFIED | 35-37 |
| `src/server/services/api/api-service.ts` | MODIFIED | 123-126, 197-199, 235-237 |
| `src/ui/web/chat/hooks/useNotebookChat.ts` | MODIFIED | 519-520, 574-575, 602-603 |
| `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` | MODIFIED | 84-85 |
| `tests/unit/queries/exercises.test.ts` | MODIFIED | add ~15 lines |
| `tests/unit/services/api-service.test.ts` | NEW | ~80 lines |
| `tests/unit/hooks/useNotebookChat.test.ts` | MODIFIED | add ~60 lines |
| `tests/unit/admin/exercise-conversion/ConvertForm.test.tsx` | NEW | ~80 lines |
