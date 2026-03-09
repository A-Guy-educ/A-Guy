# Plan: 260303-auto-65 — Refactor duplicated formatSlug to shared Hebrew-safe utility

## Rerun Context

Previous run was a generic `/cody rerun` with no specific failure feedback. This plan is written fresh with full source analysis completed. The rerun-feedback.md contained no actionable issues to address — proceeding with a clean plan.

## Assumptions

1. The `slugify` package (v1.6.6+) is already installed (`package.json` line 182).
2. The Exercises `formatSlug.ts` is the reference implementation to replicate.
3. The Exercises file will become a thin re-export (minimal diff, preserves import paths in `hooks.ts`).
4. The Lessons hook appends a timestamp suffix *after* calling `formatSlug` — this is collection-level uniqueness logic and is NOT moved into the shared utility (per FR-006, NFR-003, Guardrails).
5. The `beforeChange` hooks in Courses/Chapters/Lessons only generate slugs when `data.title` exists AND `data.slug` is falsy — this "only on create/empty slug" guard is preserved exactly (per FR-006).

---

## Step 1: Create the shared `formatSlug` utility with unit tests (FR-001, NFR-001, NFR-004)

**Time estimate**: 15–20 minutes

### Files to Touch

| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/fields/formatSlug.ts` | **NEW** | ~25 lines |
| `tests/unit/fields/formatSlug.test.ts` | **NEW** | ~80 lines |

### Exact Behavior

Create `src/server/payload/fields/formatSlug.ts` exporting:

```typescript
export function formatSlug(input: string, fallback?: string): string
```

- Uses `slugify(input, { lower: true, strict: true, locale: 'he', remove: /[*#@]/g })`.
- If result is empty and `fallback` is provided, returns `fallback`.
- If result is empty and no fallback, returns `item-${Date.now().toString(36)}` (matches Exercises behavior).
- Pure function — no database calls, no side effects.

This is an exact copy of the logic in `src/server/payload/collections/Exercises/formatSlug.ts` (lines 1–20).

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/fields/formatSlug.test.ts`

1. **Test: Hebrew-only title produces non-empty slug** — `formatSlug("שלום עולם")` returns a non-empty string containing Hebrew characters transliterated/preserved by slugify with `locale: 'he'`. FAILS before because the file doesn't exist.

2. **Test: English title produces lowercase hyphenated slug** — `formatSlug("Hello World")` returns `"hello-world"`. Verifies basic Latin behavior is preserved.

3. **Test: Mixed Hebrew/English title produces non-empty slug** — `formatSlug("כיתה 8 - Algebra בסיסי")` returns a non-empty string. Ensures RTL/LTR mix doesn't break.

4. **Test: Punctuation-only input returns fallback** — `formatSlug("!@#$%")` returns a non-empty fallback string (matching `item-<base36>` pattern when no explicit fallback provided). `formatSlug("!@#$%", "my-fallback")` returns `"my-fallback"`.

5. **Test: Whitespace-only input returns fallback** — `formatSlug("   ")` returns non-empty fallback.

6. **Test: Empty string returns fallback** — `formatSlug("")` returns non-empty fallback.

7. **Test: strict mode removes special chars** — `formatSlug("Test & Demo: v2.0")` returns `"test-and-demo-v20"` or similar (strict mode removes unsupported punctuation).

### Acceptance Criteria

- [ ] File `src/server/payload/fields/formatSlug.ts` exists and exports `formatSlug`
- [ ] All 7 unit tests pass
- [ ] Hebrew-only title → non-empty slug (NFR-001)
- [ ] Fallback behavior works for empty/punctuation inputs (FR-001)
- [ ] Function is pure — no imports of payload, no database calls (NFR-003)

---

## Step 2: Replace inline formatSlug in Courses, Chapters, and Lessons (FR-002, FR-003, FR-004)

**Time estimate**: 10–15 minutes

### Files to Touch

| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/collections/Courses.ts` | **MODIFIED** | Remove lines 22–26, add import at ~line 14 |
| `src/server/payload/collections/Chapters.ts` | **MODIFIED** | Remove lines 9–13, add import at ~line 8 |
| `src/server/payload/collections/Lessons.ts` | **MODIFIED** | Remove lines 9–13, add import at ~line 8 |
| `tests/unit/collections/formatSlug-integration.test.ts` | **NEW** | ~90 lines |

### Exact Behavior

For each of the 3 files:

1. **Remove** the inline `const formatSlug = (val: string): string => ...` function (3 lines each).
2. **Add** `import { formatSlug } from '@/server/payload/fields/formatSlug'` at the top of the file.
3. **Do NOT change** the `beforeChange` hook logic — the `if (data?.title && !data?.slug)` guard remains identical.
4. **Do NOT change** the Lessons timestamp suffix logic (lines 29–33 of Lessons.ts) — that stays as-is, it just calls the shared `formatSlug` now.

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/collections/formatSlug-integration.test.ts`

1. **Test: Courses beforeChange hook generates Hebrew-safe slug** — Simulate calling the Courses `beforeChange` hook with `data = { title: "שלום עולם" }` (no slug). Assert `data.slug` is non-empty and does NOT strip Hebrew. FAILS before because Courses still uses regex that strips Hebrew.

2. **Test: Chapters beforeChange hook generates Hebrew-safe slug** — Same pattern as above for Chapters.

3. **Test: Lessons beforeChange hook generates slug with timestamp suffix** — Simulate calling the Lessons `beforeChange` hook with `data = { title: "שיעור ראשון" }` (no slug). Assert `data.slug` is non-empty, contains Hebrew characters, and ends with a timestamp suffix (matches pattern `{slug}-{6digits}`).

4. **Test: Existing slug is NOT overwritten on update** — Simulate calling any collection's `beforeChange` hook with `data = { title: "New Title", slug: "existing-slug" }`. Assert `data.slug` remains `"existing-slug"` (FR-006 — no unintended rewrites).

5. **Test: Missing title does not generate slug** — Simulate hook with `data = { slug: undefined }` (no title). Assert `data.slug` remains `undefined`.

**Implementation note for tests**: These tests should import the actual collection configs (Courses, Chapters, Lessons), extract the first `beforeChange` hook function, and call it with mock data. Alternatively, they can import the configs and check that the `formatSlug` is being called correctly by verifying the slug output matches the shared utility's behavior.

### Acceptance Criteria

- [ ] No inline `formatSlug` function remains in Courses.ts, Chapters.ts, or Lessons.ts
- [ ] Each file imports `formatSlug` from `@/server/payload/fields/formatSlug`
- [ ] `beforeChange` hook guards (`if (data?.title && !data?.slug)`) are unchanged
- [ ] Lessons timestamp suffix logic is unchanged
- [ ] Hebrew titles produce valid slugs in all 3 collections
- [ ] Existing slugs are NOT overwritten (FR-006)
- [ ] `pnpm -s tsc --noEmit` passes with no errors

---

## Step 3: Update Exercises formatSlug to re-export shared utility (FR-005)

**Time estimate**: 10 minutes

### Files to Touch

| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/collections/Exercises/formatSlug.ts` | **MODIFIED** | Replace lines 1–20 with re-export (~2 lines) |
| `tests/unit/collections/exercises-hooks.test.ts` | **MODIFIED** | No changes needed — existing tests should still pass |

### Exact Behavior

Replace the entire `Exercises/formatSlug.ts` file content with:

```typescript
/**
 * Re-export shared formatSlug utility.
 * Exercises hooks.ts imports from this path — kept as thin re-export for minimal diff.
 */
export { formatSlug } from '@/server/payload/fields/formatSlug'
```

This ensures:
- `src/server/payload/collections/Exercises/hooks.ts` line 3 (`import { formatSlug } from './formatSlug'`) continues to work with ZERO changes.
- All 4 collections use the exact same `formatSlug` implementation.
- The Exercises uniqueness/suffixing logic in `hooks.ts` (lines 33–58) is completely untouched.

### Tests (FAIL before, PASS after)

The existing test suite at `tests/unit/collections/exercises-hooks.test.ts` (369 lines) serves as the regression gate. All 15+ existing tests MUST continue to pass after this change:

1. **Test (existing): `returns formatted slug when no conflict exists`** — line 44. Must still return `"test-exercise"` for title `"Test Exercise"`.
2. **Test (existing): `appends -1 when base slug conflicts`** — line 81. Must still produce `"test-exercise-1"`.
3. **Test (existing): `throws error after MAX_SLUG_ATTEMPTS`** — line 129. Uniqueness loop still works.

No new tests needed — if the re-export is correct, all existing tests pass. If not, they fail immediately.

### Acceptance Criteria

- [ ] `src/server/payload/collections/Exercises/formatSlug.ts` contains only a re-export
- [ ] `src/server/payload/collections/Exercises/hooks.ts` is NOT modified
- [ ] All existing tests in `tests/unit/collections/exercises-hooks.test.ts` pass
- [ ] `pnpm -s tsc --noEmit` passes with no errors

---

## Step 4: Final validation — TypeScript, lint, and full test suite (NFR-002, NFR-004)

**Time estimate**: 5 minutes

### Files to Touch

None — this is a verification step.

### Commands to Run

```bash
# Type check — no errors
pnpm -s tsc --noEmit

# Lint — no new errors
pnpm -s lint

# Run all unit tests
pnpm test:unit

# Run specific test files
pnpm vitest run tests/unit/fields/formatSlug.test.ts
pnpm vitest run tests/unit/collections/formatSlug-integration.test.ts
pnpm vitest run tests/unit/collections/exercises-hooks.test.ts
```

### Acceptance Criteria

- [ ] `tsc --noEmit` exits 0
- [ ] `pnpm -s lint` exits 0 (or no new errors)
- [ ] All new tests pass (Step 1 + Step 2 tests)
- [ ] All existing Exercises hooks tests pass (Step 3 regression)
- [ ] No access control, routing, relationship, or publishing logic was changed (NFR-002)
- [ ] No data migrations were introduced (Guardrails)

---

## Summary of All Files Changed

| File | Action | Spec Req |
|------|--------|----------|
| `src/server/payload/fields/formatSlug.ts` | **NEW** | FR-001 |
| `src/server/payload/collections/Courses.ts` | **MODIFIED** (remove inline fn, add import) | FR-002 |
| `src/server/payload/collections/Chapters.ts` | **MODIFIED** (remove inline fn, add import) | FR-003 |
| `src/server/payload/collections/Lessons.ts` | **MODIFIED** (remove inline fn, add import) | FR-004 |
| `src/server/payload/collections/Exercises/formatSlug.ts` | **MODIFIED** (re-export) | FR-005 |
| `tests/unit/fields/formatSlug.test.ts` | **NEW** | NFR-004 |
| `tests/unit/collections/formatSlug-integration.test.ts` | **NEW** | FR-006, NFR-001 |

**Total: 5 source files (1 new, 4 modified) + 2 test files (both new)**

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `slugify` with `locale: 'he'` behaves differently than regex for Latin chars | Unit tests cover English-only, Hebrew-only, and mixed inputs |
| Exercises hooks break after re-export | Existing 15+ tests serve as regression gate |
| Slug regeneration on update | Guard `if (data?.title && !data?.slug)` is preserved exactly — integration tests verify |
| Lessons timestamp suffix breaks | Integration test specifically validates suffix pattern |
| Import path resolution | TypeScript compilation (`tsc --noEmit`) catches any path issues |

## Open Questions Resolution

1. **Q: Keep Exercises local file or delete?** → **Keep as thin re-export** (minimal diff, `hooks.ts` import unchanged).
2. **Q: Existing tests?** → `exercises-hooks.test.ts` exists with 15+ tests; they serve as regression gate. New tests added for shared utility and collection integration.
3. **Q: Fallback behavior?** → Match exactly the current Exercises fallback: `item-${Date.now().toString(36)}`. This is time-based, not deterministic, which is acceptable per spec.
