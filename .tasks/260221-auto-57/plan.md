# Plan: 260221-auto-57 — Log Caught Errors in Catch Blocks

## Summary

Several `catch` blocks across four files silently discard the original error, making debugging difficult. This plan adds `console.error` logging to each identified catch block, renames unused `_error`/`_err` variables to active names, and adds an error variable to bare `catch` clauses — all while preserving existing fallback behavior exactly as-is.

## Assumptions

- `console.error` is the appropriate logging mechanism (per spec: "A simple `console.error` is sufficient").
- For `api-service.ts`, we use `logger.error` instead of `console.error` since the file already imports `logger` from `@/infra/utils/logger` and uses it elsewhere. This is more consistent with the codebase and still satisfies the spec's intent of "log the original error."
- The bare `catch` on line 47 of ConvertForm needs an `error` variable added.
- No new tests exist for verifying `console.error` calls in these files; we will write minimal unit-style tests using `vi.spyOn(console, 'error')` or equivalent to confirm the error is logged.

---

## Step 1: Fix `exercises.ts` — Log error in `queryExerciseById` catch block

**Root Cause**: The `catch (_error)` block on line 35 discards the error, returning `null` without any logging.

**Spec Requirements**: NFR-001, NFR-005, NFR-006

**Files to Touch**:
- `src/server/repos/queries/exercises.ts` (MODIFIED — lines 35-37)

**Current Code (lines 35-37)**:
```typescript
} catch (_error) {
  return null
}
```

**Fix**: Rename `_error` → `error`, add `console.error` before `return null`:
```typescript
} catch (error) {
  console.error('[queryExerciseById] Failed to fetch exercise:', error)
  return null
}
```

**Reproduction Test**:
- Test location: `tests/unit/server/repos/queries/exercises.test.ts` (NEW)
- Test: Mock `payload.findByID` to throw, call `queryExerciseById`, assert `console.error` was called with the original error AND function returns `null`.
- Why it fails now: `console.error` is never called in the catch block.

**Acceptance Criteria**:
- [ ] `catch` variable renamed from `_error` to `error`
- [ ] `console.error` is called with descriptive prefix and the error object
- [ ] Function still returns `null` on error (NFR-005)
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)
- [ ] No lint warnings for unused variables

---

## Step 2: Fix `api-service.ts` — Log errors in `chat`, `getConversation`, and `resetChat` catch blocks

**Root Cause**: Three `catch (_error)` blocks (lines 123, 197, 235) discard errors, returning generic `{ success: false, error: 'Network error' }` responses without any logging.

**Spec Requirements**: NFR-002, NFR-005, NFR-006

**Files to Touch**:
- `src/server/services/api/api-service.ts` (MODIFIED — lines 123-126, 197-199, 235-237)

**Current Code**:
```typescript
// Line 123 (chat method)
} catch (_error) {
  return { success: false, error: 'Network error' }
}

// Line 197 (getConversation method)
} catch (_error) {
  return { success: false, exists: false, messages: [], error: 'Network error' }
}

// Line 235 (resetChat method)
} catch (_error) {
  return { success: false, error: 'Network error' }
}
```

**Fix**: Rename `_error` → `error` in all three, add `logger.error` before each return (the file already imports `logger`):

```typescript
// Line 123 (chat method)
} catch (error) {
  logger.error({ err: error }, '[apiService.chat] Network error')
  return { success: false, error: 'Network error' }
}

// Line 197 (getConversation method)
} catch (error) {
  logger.error({ err: error }, '[apiService.getConversation] Network error')
  return { success: false, exists: false, messages: [], error: 'Network error' }
}

// Line 235 (resetChat method)
} catch (error) {
  logger.error({ err: error }, '[apiService.resetChat] Network error')
  return { success: false, error: 'Network error' }
}
```

**Note**: Using `logger.error` instead of `console.error` because `api-service.ts` already imports `logger` from `@/infra/utils/logger` and uses it throughout. This is the idiomatic pattern for this file and satisfies NFR-002's intent. The `{ err: error }` pattern is consistent with existing logger usage in the codebase (e.g., `useNotebookChat.ts` line 298).

**Reproduction Test**:
- Test location: `tests/unit/server/services/api/api-service.test.ts` (NEW)
- Test 1: Mock `fetch` to throw (network failure), call `apiService.chat(...)`, assert `logger.error` was called with the error AND response is `{ success: false, error: 'Network error' }`.
- Test 2: Mock `fetch` to throw, call `apiService.getConversation(...)`, assert `logger.error` was called AND response is `{ success: false, exists: false, messages: [], error: 'Network error' }`.
- Test 3: Mock `fetch` to throw, call `apiService.resetChat(...)`, assert `logger.error` was called AND response is `{ success: false, error: 'Network error' }`.
- Why they fail now: `logger.error` is never called in these catch blocks.

**Acceptance Criteria**:
- [ ] All three `catch` variables renamed from `_error` to `error`
- [ ] `logger.error` is called with `{ err: error }` and descriptive message in each catch block
- [ ] All three return values remain exactly the same (NFR-005)
- [ ] No TypeScript errors
- [ ] No lint warnings for unused variables

---

## Step 3: Fix `useNotebookChat.ts` — Log errors in `streamMessage`, `sendMessageSync`, and `handleReset` catch blocks

**Root Cause**: Three `catch (_error)` blocks (lines 519, 574, 602) show a toast error but discard the original error object, making debugging impossible.

**Spec Requirements**: NFR-003, NFR-005, NFR-006

**Files to Touch**:
- `src/ui/web/chat/hooks/useNotebookChat.ts` (MODIFIED — lines 519-520, 574-575, 602-603)

**Current Code**:
```typescript
// Line 519 (streamMessage)
} catch (_error) {
  toast.error(errorMessage)
}

// Line 574 (sendMessageSync)
} catch (_error) {
  toast.error(errorMessage)
}

// Line 602 (handleReset)
} catch (_error) {
  toast.error(resetErrorMessage)
}
```

**Fix**: Rename `_error` → `error` in all three, add `console.error` before each toast call:

```typescript
// Line 519 (streamMessage)
} catch (error) {
  console.error('[useNotebookChat] Stream message error:', error)
  toast.error(errorMessage)
}

// Line 574 (sendMessageSync)
} catch (error) {
  console.error('[useNotebookChat] Send message sync error:', error)
  toast.error(errorMessage)
}

// Line 602 (handleReset)
} catch (error) {
  console.error('[useNotebookChat] Reset chat error:', error)
  toast.error(resetErrorMessage)
}
```

**Note**: Using `console.error` here (not `logger`) because these are client-side catch blocks that previously had no logging at all. The file does import `logger`, but the existing pattern for these specific catch blocks was plain toast with no logging. `console.error` is the simplest addition that satisfies the spec. However, if the build agent prefers `logger.error` for consistency with other parts of this file, that's also acceptable — the key requirement is that the original error object gets logged.

**Reproduction Test**:
- Test location: `tests/unit/ui/web/chat/hooks/useNotebookChat.test.ts` (NEW)
- Test 1: Mock `apiService.chatStream` to throw, trigger `streamMessage`, assert `console.error` was called with the error AND `toast.error` was still called.
- Test 2: Mock `apiService.chat` to throw, trigger `sendMessageSync`, assert `console.error` was called with the error AND `toast.error` was still called.
- Why they fail now: `console.error` is never called in these catch blocks.

**Acceptance Criteria**:
- [ ] All three `catch` variables renamed from `_error` to `error`
- [ ] `console.error` is called with descriptive prefix and error object in each catch block
- [ ] All three toast calls remain exactly the same (NFR-005)
- [ ] No TypeScript errors
- [ ] No lint warnings for unused variables

---

## Step 4: Fix `ConvertForm/index.tsx` — Log errors in `loadPrompts` and `handleSubmit` catch blocks

**Root Cause**: Two catch blocks discard errors. Line 47 has a bare `catch` with no variable at all. Line 84 has `catch (_err)` which discards the error.

**Spec Requirements**: NFR-004, NFR-005, NFR-006

**Files to Touch**:
- `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` (MODIFIED — lines 47-48, 84-85)

**Current Code**:
```typescript
// Line 47 (loadPrompts)
} catch {
  setError('Failed to load prompts')
}

// Line 84 (handleSubmit)
} catch (_err) {
  setError('Queue failed')
}
```

**Fix**: Add `error` variable to bare catch, rename `_err` → `error`, add `console.error` before `setError`:

```typescript
// Line 47 (loadPrompts)
} catch (error) {
  console.error('[ConvertForm] Failed to load prompts:', error)
  setError('Failed to load prompts')
}

// Line 84 (handleSubmit)
} catch (error) {
  console.error('[ConvertForm] Queue failed:', error)
  setError('Queue failed')
}
```

**Reproduction Test**:
- Test location: `tests/unit/ui/admin/exercise-conversion/ConvertForm.test.tsx` (NEW)
- Test 1: Mock `fetch` to throw during prompt loading, render `<ConvertForm .../>`, assert `console.error` was called with the error AND the UI shows 'Failed to load prompts'.
- Test 2: Mock `fetch` to throw during form submission, render and submit the form, assert `console.error` was called with the error AND the UI shows 'Queue failed'.
- Why they fail now: `console.error` is never called in these catch blocks.

**Acceptance Criteria**:
- [ ] Bare `catch` on line 47 now captures the error as `catch (error)`
- [ ] `_err` on line 84 renamed to `error`
- [ ] `console.error` is called with descriptive prefix and error object in both catch blocks
- [ ] Both `setError` calls remain exactly the same (NFR-005)
- [ ] No TypeScript errors
- [ ] No lint warnings for unused variables

---

## Step 5: Final Verification — TypeScript + Lint Check

**Files to Touch**: None (verification only)

**Commands**:
```bash
pnpm tsc --noEmit
pnpm lint
```

**Acceptance Criteria**:
- [ ] `pnpm tsc --noEmit` passes with zero new errors
- [ ] `pnpm lint` passes with zero new warnings/errors (especially no unused-variable warnings)
- [ ] All 4 files modified, no other files changed
- [ ] All existing behavior preserved — return values, toast calls, setError calls unchanged

---

## Full Acceptance Criteria Summary (from spec)

- [AC-1] `console.error` (or `logger.error`) called in catch block of `exercises.ts` (NFR-001)
- [AC-2] `logger.error` called in all 3 catch blocks of `api-service.ts` (NFR-002)
- [AC-3] `console.error` called in all 3 catch blocks of `useNotebookChat.ts` (NFR-003)
- [AC-4] `console.error` called in both catch blocks of `ConvertForm/index.tsx` (NFR-004)
- [AC-5] Existing catch block behavior unchanged (NFR-005)
- [AC-6] All `_error`/`_err` variables renamed to `error`; bare `catch` gets `error` variable (NFR-006)
- [AC-7] TypeScript compilation succeeds
- [AC-8] Linting succeeds with no new warnings

## Estimated Time

- Steps 1-4: ~5 minutes each (simple 2-line changes + tests)
- Step 5: ~5 minutes (verification)
- **Total: ~25 minutes**
