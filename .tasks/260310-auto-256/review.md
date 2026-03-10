# Code Review: Formula Sheet Feature (Issue #751 / Task 260310-auto-256)

## Review Context

This is a fix-mode review triggered by `@cody fix` on PR #751. The reviewer (yaeliavni) identified 6 specific bugs that need fixing. This review validates those findings against the actual code and identifies any additional issues.

---

## Critical Findings

### C1: Toggle is broken — viewer opens but never closes (Bug 1)

**Files:**
- `src/ui/web/chat/FormulaSheetButton/index.tsx:38`
- `src/ui/web/chat/ChatInterface/index.tsx:318-319,536-542`

**Problem:** `FormulaSheetButton` maintains its own internal `isOpen` state (line 38) that is completely disconnected from the parent `ChatInterface`'s `formulaSheetOpen` state (line 318). When the button is clicked:

1. First click: `FormulaSheetButton` sets its `isOpen` to `true` and calls `onOpen(data)` (line 98-102), which sets the parent's `formulaSheetOpen` to `true` and opens the viewer.
2. User closes viewer via X button: Parent sets `formulaSheetOpen` to `false` (line 739), but `FormulaSheetButton`'s internal `isOpen` remains `true`.
3. Second click: Button toggles its `isOpen` to `false` (line 98), but since `newIsOpen` is `false`, `onOpen` is never called — the parent state never changes. The viewer stays closed and the button is now in a desynced state.
4. Third click: Button toggles `isOpen` back to `true` and calls `onOpen` — viewer opens again. But the button never provides a way to close the viewer.

There is no `onClose` callback; the button can only open. There is no `isOpen` prop from the parent. The two state stores are permanently out of sync.

**Fix:** Remove `isOpen` from `FormulaSheetButton`. Accept `isOpen` prop from parent and an `onToggle` callback. The parent `ChatInterface` should be the single source of truth. When clicked, call `onToggle` to flip the parent state.

---

### C2: Guest/public users cannot see formula sheets (Bug 2)

**Files:**
- `src/app/api/formula-sheet/route.ts:54-58` (lesson fetch)
- `src/app/api/formula-sheet/route.ts:87-93` (chapter fetch)
- `src/app/api/formula-sheet/route.ts:98-104` (course fetch)
- `src/server/repos/queries/formula-sheets.ts:69-75` (lesson fetch)
- `src/server/repos/queries/formula-sheets.ts:101-107` (chapter fetch)
- `src/server/repos/queries/formula-sheets.ts:112-118` (course fetch)

**Problem:** Both the API route and the query repo use `overrideAccess: false` when fetching the lesson, chapter, and course. The Lessons, Chapters, and Courses collections likely require authentication for read access. This means unauthenticated (guest) users will get `null` back even when a formula sheet exists for a published lesson.

Per the spec (FR Visibility & Access): "The button and sheet are visible to all users (public or authenticated) who are viewing a published lesson."

**Fix:** Change `overrideAccess: false` to `overrideAccess: true` for the lesson, chapter, and course reads in the resolution chain. The code already checks `lesson.status === 'published'` and `lesson.isActive` manually (line 68/78), which is the correct guard. The formula-sheet reads already use `overrideAccess: true`.

---

## Major Findings

### M1: Fully duplicated query logic (Bug 3)

**Files:**
- `src/app/api/formula-sheet/route.ts:43-224` — inline `queryFormulaSheetForLesson`
- `src/server/repos/queries/formula-sheets.ts:57-181` — canonical `queryFormulaSheetForLesson`

**Problem:** The entire query function is duplicated between the API route file and the repo query file. They have identical logic, identical locale fallback, identical DTO construction. The API route defines its own local `queryFormulaSheetForLesson` wrapped in `cache()` and never imports the one from `src/server/repos/queries/formula-sheets.ts`. This means:

1. Bug fixes applied to one copy will not be applied to the other.
2. Any consumer importing from the repo file will get different behavior once fixes diverge.
3. The duplicate `FormulaSheetDTO` type definition and `isRichTextEmpty` function add unnecessary code.

**Fix:** Delete the duplicate from `route.ts`. Import and use the function from `src/server/repos/queries/formula-sheets.ts` instead. Also export `FormulaSheetDTO` type from the repo file (already done at line 17).

---

### M2: Missing `type` field on FormulaSheets collection (Bug 4)

**Files:**
- `src/server/payload/collections/FormulaSheets.ts:60-96`
- `src/app/api/formula-sheet/route.ts:202`
- `src/server/repos/queries/formula-sheets.ts:159`

**Problem:** The spec requires an explicit `type` field on the FormulaSheets collection:
> type: Select ['richtext', 'pdf']

This lets admins explicitly declare whether a sheet is richtext or PDF. Currently the code infers `kind` from whether `pdfFile` exists:
```typescript
kind: sheet.pdfFile ? 'pdf' : 'richtext',  // route.ts:202, formula-sheets.ts:159
```

This means a sheet with both richtext content AND a PDF file will always show as PDF with no admin control. The admin has no way to override this behavior.

**Fix:** Add a `type` field (select, options: `['richtext', 'pdf']`, required) to the FormulaSheets collection. Use this field instead of presence-based inference to determine `kind` in the DTO and in `FormulaSheetViewer` rendering. Run `pnpm generate:types` after.

---

### M3: No backdrop dismiss on desktop viewer modal (Bug 5)

**Files:**
- `src/ui/web/chat/FormulaSheetViewer/index.tsx:117-123`

**Problem:** On desktop, the viewer renders as a modal with a dark backdrop (`bg-black/50` at line 118). Clicking the backdrop does nothing — only the X button closes the modal. This is unexpected UX for a modal overlay; users expect clicking outside the modal content to dismiss it.

**Fix:** Add `onClick={onClose}` on the backdrop div (line 118). Add `e.stopPropagation()` on the inner modal container (line 119) to prevent clicks inside the modal from propagating to the backdrop.

---

### M4: Missing integration test for formula sheet resolution (Bug 6)

**Files:** No test file found at `tests/int/formula-sheet-resolution.int.spec.ts` or any `tests/int/*formula*.spec.ts`.

**Problem:** The spec explicitly requires: "Add an integration test in `tests/int/formula-sheet-resolution.int.spec.ts` to verify the fallback logic (Lesson > Course)." The plan specified 15 integration tests. None were created. The build report mentions tests passed but only references unit tests (3134 tests passed), not formula-sheet-specific integration tests.

**Fix:** Create `tests/int/formula-sheet-resolution.int.spec.ts` with tests covering:
1. Lesson with its own formula sheet returns the lesson sheet
2. Lesson without a formula sheet falls back to the course default
3. Lesson with no sheet and course with no sheet returns null (button hidden)
4. Locale fallback: `he` not found → falls back to `en`

---

## Minor Findings

### m1: Missing PDF error hides button instead of showing error

**File:** `src/ui/web/chat/FormulaSheetButton/index.tsx:93-95`

**Problem:** When `sheet.pdfStatus === 'missing'`, the button is hidden entirely (returns `null`). But per the spec edge case: "If a sheet is type PDF but the file is missing, display: 'Formula sheet could not be loaded.'" The button should still show, and clicking it should open the viewer with the error message. The viewer already handles this case correctly at line 44-69 of `FormulaSheetViewer`.

**Fix:** Remove the `sheet.pdfStatus === 'missing'` check from the hide condition in `FormulaSheetButton`. Allow the button to show so the viewer can display the error.

---

### m2: `react` `cache()` misused in API route

**File:** `src/app/api/formula-sheet/route.ts:12,43`

**Problem:** The `cache()` function from React is imported and used to wrap `queryFormulaSheetForLesson`. React's `cache()` memoizes within a single React Server Component render tree. In an API route handler (`GET` function), this memoization doesn't provide any benefit — each request gets a fresh execution context. It doesn't cache across requests.

**Fix:** Remove the `cache()` wrapper from the API route's copy (which should be deleted anyway per M1). The repo file's usage of `cache()` is also questionable since it's used in an API route context, but less harmful since it's a server utility.

---

### m3: Keyboard accessibility — no Escape key handler

**File:** `src/ui/web/chat/FormulaSheetViewer/index.tsx:25-124`

**Problem:** The modal/drawer has no keyboard event handler. Users cannot press Escape to close the formula sheet viewer, which is a standard accessibility pattern for modal dialogs. There's also no focus trap, so keyboard users can tab out of the modal into the page behind it.

**Fix:** Add a `useEffect` that listens for `keydown` events and calls `onClose` when Escape is pressed. Consider adding a focus trap for full accessibility compliance.

---

### m4: `FormulaSheetButton` hides during loading — no skeleton

**File:** `src/ui/web/chat/FormulaSheetButton/index.tsx:88-90`

**Problem:** The spec requires: "Provide a loading skeleton while content is fetching." Currently, while `isLoading` is true, the button returns `null` (invisible). No loading skeleton is shown. The plan also specified: "Shows loading skeleton while fetching."

**Fix:** Add a loading skeleton placeholder while `isLoading` is true instead of returning null.

---

### m5: Locale query on formula sheet uses `find` with `id equals` instead of `findByID`

**Files:**
- `src/app/api/formula-sheet/route.ts:135-144`
- `src/server/repos/queries/formula-sheets.ts:197-206`

**Problem:** The code queries formula sheets using `payload.find({ where: { and: [{ id: { equals: candidateSheetId } }, { locale: { equals: locale } }] } })`. Since `locale` is a field on the document (not Payload's built-in i18n locale), this is functionally correct. However, using `find` with an `id` filter when you know the exact document ID is less efficient than `findByID`. The `locale` filter could be applied as a post-fetch check after `findByID`.

This is a minor performance concern — not a bug. The current approach works correctly but adds unnecessary query overhead.

---

### m6: Validation error swallowed in `validatePdfFile`

**File:** `src/server/payload/collections/FormulaSheets/validateFormulaSheet.ts:79-82`

**Problem:** The `catch` block at line 79 silently swallows all errors, including the deliberately thrown `Error('Linked file must be a PDF')` and `Error('PDF file must be smaller than 5MB')` from lines 72 and 77. The outer try/catch catches the inner throws, meaning PDF validation errors are never surfaced to the admin.

**Fix:** Re-throw known validation errors. Only catch unexpected errors (e.g., media doc not found):
```typescript
} catch (error) {
  if (error instanceof Error && (error.message.includes('PDF') || error.message.includes('5MB'))) {
    throw error // Re-throw validation errors
  }
  // If we can't verify, allow it
}
```

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | C1, C2 |
| Major | 4 | M1, M2, M3, M4 |
| Minor | 6 | m1, m2, m3, m4, m5, m6 |

All 6 bugs identified by the reviewer (yaeliavni) are confirmed as valid findings (C1=Bug1, C2=Bug2, M1=Bug3, M2=Bug4, M3=Bug5, M4=Bug6). Additional issues m1-m6 were found during review.

### Priority Fix Order

1. **C1** — Toggle broken (state desync between button and parent)
2. **C2** — Guest users blocked from formula sheets (access control)
3. **M1** — Duplicated query logic (delete duplicate, import canonical)
4. **M2** — Missing `type` field on collection (schema change + regenerate types)
5. **M3** — Backdrop dismiss missing (UX fix)
6. **M4** — Missing integration test (create test file)
7. **m1** — Missing PDF hides button instead of showing error
8. **m6** — Validation errors swallowed
9. **m3** — Escape key handler missing
10. **m4** — Loading skeleton missing
