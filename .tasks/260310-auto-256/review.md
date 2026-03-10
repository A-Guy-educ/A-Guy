# Code Review — Task 260310-auto-256

**Branch**: `feat/260308-auto-750-equation-paper`
**Scope**: Fix two bugs in the formula sheet feature per `@cody fix` request (third attempt)
**Fix request**: Bug 1 (toggle broken), Bug 2 (duplicated query logic)

---

## Critical Issues

_None found._

---

## Major Issues

### M1: Toggle state desync — viewer opens but never closes via button

**Severity**: Major (broken UX — core user interaction)
**Files**:
- `src/ui/web/chat/FormulaSheetButton/index.tsx:38,97-103`
- `src/ui/web/chat/ChatInterface/index.tsx:318,535-541`

**Problem**: `FormulaSheetButton` owns an internal `isOpen` state (line 38) that is completely independent from `ChatInterface`'s `formulaSheetOpen` state (line 318). The only communication path is the `onOpen` callback, which fires only when opening:

```tsx
// FormulaSheetButton/index.tsx — lines 97-103
const handleClick = () => {
  const newIsOpen = !isOpen        // toggles LOCAL state
  setIsOpen(newIsOpen)
  if (newIsOpen && onOpen) {       // only fires on OPEN, never on close
    onOpen(sheet)
  }
}
```

**Desync scenario**:
1. First click: `isOpen` → `true`, calls `onOpen(sheet)`. Parent sets `formulaSheetOpen = true`, viewer opens.
2. User closes viewer via X button: Parent sets `formulaSheetOpen = false` (line 739). But button's internal `isOpen` stays `true`.
3. Second click: `isOpen` toggles to `false`. Since `newIsOpen` is `false`, `onOpen` is never called. Nothing happens visually.
4. Third click: `isOpen` toggles to `true`, `onOpen` fires again. Viewer opens. But the button **can never close** the viewer.

There is no `onClose` callback, no `onToggle` callback, and no `isOpen` prop from the parent. The two state stores are permanently out of sync.

**Fix**: Remove `isOpen` from `FormulaSheetButton`. Accept `isOpen` as a prop from the parent and an `onToggle` callback. The parent (`ChatInterface`) becomes the single source of truth. In `ChatInterface`, wire `FormulaSheetButton`:

```tsx
<FormulaSheetButton
  lessonId={lessonId}
  isOpen={formulaSheetOpen}
  onToggle={() => {
    if (!formulaSheetOpen && sheet) {
      setFormulaSheetData(sheet)
    }
    setFormulaSheetOpen(!formulaSheetOpen)
  }}
/>
```

When `isOpen` is true, apply an active visual state on the button (e.g., `isOpen && 'bg-primary/20 ring-2 ring-primary/30'`).

---

### M2: Fully duplicated query logic between API route and repository

**Severity**: Major (maintainability — code will drift and cause inconsistent behavior)
**Files**:
- `src/app/api/formula-sheet/route.ts:16-224` — inline `queryFormulaSheetForLesson` + `FormulaSheetDTO` + `isRichTextEmpty`
- `src/server/repos/queries/formula-sheets.ts:17-226` — canonical version of same

**Problem**: `queryFormulaSheetForLesson` is fully implemented twice with near-identical logic. Key differences that already indicate drift:

| Aspect | `route.ts` | `formula-sheets.ts` |
|--------|-----------|---------------------|
| Default locale | Hardcoded `'he'` (line 46) | `DEFAULT_CONTENT_LOCALE` constant (line 60) |
| Lesson typing | Inline `as` cast with manual type (lines 60-65) | Uses Payload's inferred types (line 69) |
| Sheet fetching | Inline `payload.find` calls (lines 135-189) | Extracted `fetchFormulaSheetById` helper (lines 141-146) |
| `chapterId` null check | Falls through silently (line 86 — `if (chapterId)`) | Returns `null` early (lines 97-99 — `if (!chapterId) return null`) |

The last divergence means: in `route.ts`, a lesson with no `chapterId` will proceed past the fallback block and hit the `if (!candidateSheetId)` check at line 121, returning `null`. In `formula-sheets.ts`, it returns `null` immediately. Same end result today, but any future change to one path won't be reflected in the other.

Additionally:
- `FormulaSheetDTO` type is defined twice (route.ts:16, formula-sheets.ts:17)
- `isRichTextEmpty` function is defined twice (route.ts:31, formula-sheets.ts:37)
- `react.cache()` wrapping in the route.ts (line 43) is ineffective — `cache()` memoizes within a React render tree, not across API route invocations

**Fix**: Delete `queryFormulaSheetForLesson`, `FormulaSheetDTO`, and `isRichTextEmpty` from `route.ts`. Import `queryFormulaSheetForLesson` and `FormulaSheetDTO` from `@/server/repos/queries/formula-sheets`. The route's `GET` handler becomes:

```typescript
import { queryFormulaSheetForLesson } from '@/server/repos/queries/formula-sheets'
// ... in GET handler:
const formulaSheet = await queryFormulaSheetForLesson({ lessonId, locale })
return NextResponse.json({ formulaSheet })
```

---

## Minor Issues

### m1: No backdrop dismiss on desktop viewer modal

**Severity**: Minor (UX)
**File**: `src/ui/web/chat/FormulaSheetViewer/index.tsx:117-123`

On desktop, clicking the dark overlay (`bg-black/50`) behind the modal does nothing. Only the X button closes it. Standard modal UX expects backdrop clicks to dismiss.

```tsx
// line 118 — no onClick on backdrop
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
```

**Fix**: Add `onClick={onClose}` on the backdrop div. Add `onClick={(e) => e.stopPropagation()}` on the inner modal container.

---

### m2: Missing active visual state on button

**Severity**: Minor (visual feedback)
**File**: `src/ui/web/chat/FormulaSheetButton/index.tsx:110-114`

The button styling doesn't change based on open/closed state — no visual distinction exists:

```tsx
className={cn(
  'flex items-center gap-2 px-3 py-2 rounded-lg ...',
  'bg-primary/10 text-primary ...',
  disabled && 'opacity-50 cursor-not-allowed',
  // Missing: active state when viewer is open
)}
```

**Fix**: After lifting `isOpen` to prop, conditionally apply: `isOpen && 'bg-primary/20 ring-2 ring-primary/30'`.

---

### m3: Keyboard accessibility — no Escape key handler on viewer

**Severity**: Minor (a11y)
**File**: `src/ui/web/chat/FormulaSheetViewer/index.tsx:25-124`

The modal has no keyboard handler. Users cannot press Escape to close, which is standard modal accessibility.

**Fix**: Add `useEffect` listening for `keydown` → Escape → `onClose()`.

---

### m4: Validation errors swallowed in `validatePdfFile`

**Severity**: Minor (admin UX)
**File**: `src/server/payload/collections/FormulaSheets/validateFormulaSheet.ts:79-82`

The `catch` block silently swallows all errors including the deliberately thrown validation errors from lines 72 and 77 (`'Linked file must be a PDF'`, `'PDF file must be smaller than 5MB'`).

**Fix**: Re-throw known validation errors; only catch unexpected errors.

---

## Summary

| # | Severity | Issue | Action Required |
|---|----------|-------|-----------------|
| M1 | **Major** | Toggle state desync — viewer opens but never closes | Fix: lift state to parent |
| M2 | **Major** | Duplicated query logic will drift | Fix: delete duplicate, import canonical |
| m1 | Minor | No backdrop dismiss on desktop modal | Recommended |
| m2 | Minor | No active visual state on button | Recommended |
| m3 | Minor | No Escape key handler on viewer | Recommended |
| m4 | Minor | PDF validation errors swallowed | Recommended |

**Verdict**: 2 major issues must be fixed. These are the exact bugs specified in the `@cody fix` request. Minor issues m1-m2 are low-effort improvements that should be included in the fix. m3-m4 are optional improvements.
