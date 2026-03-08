# Plan: Equation Paper (דף נוסחאות) Feature

## Rerun Context

This is a rerun with minimal feedback ("Rerun requested via /cody rerun"). The previous plan was not found (first run was incomplete). This plan is written from scratch based on spec.md and clarified.md.

---

## Overview

This feature provides students access to mathematical formula sheets during chat sessions. It consists of:
1. A new `FormulaSheets` Payload CMS collection (FR-001)
2. A `formulaSheet` relationship field on `Lessons` (FR-002)
3. A `defaultFormulaSheet` relationship field on `Courses` (FR-003)
4. A formula sheet viewer UI in the chat interface with precedence logic (lesson > course > hide)
5. A migration script for course 471 content (FR-004)

### Assumptions
- The formula sheet content format uses Payload's Lexical richText editor (same as `defaultLexical`)
- PDF files are uploaded to the existing `media` collection (no separate upload collection needed)
- The content locale field (`locale`) uses the existing `contentLocaleField` from `src/server/payload/fields/contentLocale.ts`
- The formula sheet viewer on mobile is a full-screen drawer; on desktop it's a side panel/modal
- The "דף נוסחאות" button is added as a toolbar item above the chat input in `ChatInterface`
- Rich text formula content is rendered through a dedicated extractor + `MathMarkdown` so LaTeX is guaranteed to render per spec
- For PDF rendering, the existing `PDFMedia` component at `src/ui/web/media/PDFMedia/index.tsx` is reused
- Figma-provided 471 sheet content is available to the task implementation and must be embedded in the one-time migration script (no placeholder)

---

## Step 1: Create FormulaSheets Collection (FR-001)

**Estimated time**: 15 minutes

**Files to Touch**:
- `src/server/payload/collections/FormulaSheets.ts` (NEW)
- `src/server/payload/collections/FormulaSheets/validateFormulaSheet.ts` (NEW)
- `src/payload.config.ts` (MODIFIED - lines 81-170, add import + register)

**Exact Behavior**:
- Create a new Payload collection with slug `formula-sheets`
- Fields:
  - `name` (text, required) — Human-readable name e.g. "471 - Calc - v1"
  - `content` (richText, optional) — Lexical rich text field for LaTeX formulas
  - `pdfFile` (upload, optional, relationTo: 'media') — PDF file reference
  - `locale` — use existing `contentLocaleField` (select: 'he'|'en', default 'he')
  - `tenant` — use existing `tenantField`
- Access: `adminOnly` for all CRUD operations (create, read, update, delete)
- Admin config: `useAsTitle: 'name'`, `defaultColumns: ['name', 'locale', 'tenant', 'updatedAt']`
- Validation (collection-level `beforeValidate` hook):
  - Enforce naming pattern: `[Course Code] - [Topic] - [Version]` (e.g. `471 - Calc - v1`)
  - Enforce non-empty source: at least one of `content` or `pdfFile` must exist
  - If `pdfFile` is set, validate linked media is a PDF and `filesize <= 5MB`
  - If richText is set but effectively empty, treat as empty content (for hide-button logic)
- Enable timestamps
- Register in `payload.config.ts` collections array

**Tests** (integration test — FAIL before, PASS after):

- **Test file**: `tests/int/formula-sheets.int.spec.ts` (NEW)
- **Test 1**: `should create a formula sheet with name and content` — Creates a formula sheet via `payload.create({ collection: 'formula-sheets', data: { name: '471 - Calc - v1' }, overrideAccess: true })`. Asserts doc has `name`, `id`, `locale` defaults to 'he'.
- **Test 2**: `should enforce admin-only access on create` — Attempts `payload.create({ collection: 'formula-sheets', data: {...}, user: studentUser, overrideAccess: false })`. Expects rejection/forbidden.
- **Test 3**: `should allow pdfFile relationship to media` — Creates a formula sheet with `pdfFile` set to a media doc ID. Asserts the relationship is saved correctly.
- **Test 4**: `should reject invalid sheet name format` — Attempts creation with invalid `name`, expects validation error.
- **Test 5**: `should reject pdfFile larger than 5MB` — Links oversized PDF media and expects validation error.
- **Test 6**: `should reject sheet with both content and pdfFile empty` — Expects validation error.

**Acceptance Criteria**:
- [ ] FormulaSheets collection exists with slug `formula-sheets`
- [ ] All CRUD operations restricted to admin role
- [ ] `name` field is required, `content` and `pdfFile` are optional
- [ ] `locale` defaults to 'he' and accepts 'he'|'en'
- [ ] `tenant` auto-populates via existing tenant hook
- [ ] Name pattern validation enforced: `[Course Code] - [Topic] - [Version]`
- [ ] PDF links are restricted to PDF files up to 5MB
- [ ] Empty sheet payloads (no content + no PDF) are rejected
- [ ] Collection registered in payload.config.ts
- [ ] `pnpm generate:types` succeeds with new collection

---

## Step 2: Add formulaSheet Field to Lessons and Courses (FR-002, FR-003)

**Estimated time**: 10 minutes

**Files to Touch**:
- `src/server/payload/collections/Lessons.ts` (MODIFIED — add field after line 238, before `slug`)
- `src/server/payload/collections/Courses.ts` (MODIFIED — add field after line 207, before `slug`)

**Exact Behavior**:
- **Lessons**: Add optional `formulaSheet` field:
  ```
  { name: 'formulaSheet', type: 'relationship', relationTo: 'formula-sheets', admin: { position: 'sidebar', description: 'Lesson-specific formula sheet override' } }
  ```
- **Courses**: Add optional `defaultFormulaSheet` field:
  ```
  { name: 'defaultFormulaSheet', type: 'relationship', relationTo: 'formula-sheets', admin: { position: 'sidebar', description: 'Default formula sheet for all lessons in this course' } }
  ```

**Tests** (integration test — extends `tests/int/formula-sheets.int.spec.ts`):

- **Test 7**: `should link formula sheet to lesson` — Creates a formula sheet, then creates a lesson with `formulaSheet: sheetId`. Fetches lesson and asserts `formulaSheet` equals the sheet ID.
- **Test 8**: `should link default formula sheet to course` — Creates a formula sheet, then creates a course with `defaultFormulaSheet: sheetId`. Fetches course and asserts `defaultFormulaSheet` equals the sheet ID.

**Acceptance Criteria**:
- [ ] Lessons collection has optional `formulaSheet` relationship field
- [ ] Courses collection has optional `defaultFormulaSheet` relationship field
- [ ] Both fields appear in admin sidebar
- [ ] Type generation succeeds (`pnpm generate:types`)
- [ ] Existing lessons/courses without the field continue to work (optional field)

---

## Step 3: Create Secure Formula Sheet Resolver and Public API

**Estimated time**: 20 minutes

**Files to Touch**:
- `src/server/repos/queries/formula-sheets.ts` (NEW)
- `src/app/api/formula-sheet/route.ts` (NEW)

**Exact Behavior**:

### Query function (`formula-sheets.ts`)
- `queryFormulaSheetForLesson({ lessonId, locale })`:
  1. Fetch lesson by ID with `depth: 0`, `overrideAccess: false`, no user context → guarantees only published+active lessons are resolvable.
  2. Resolve candidate source by strict precedence:
     - if `lesson.formulaSheet` exists, use lesson source only
     - else resolve chapter → course (`depth: 0`) and use `course.defaultFormulaSheet`
  3. Locale resolution for selected source (no source switching):
     - try requested locale first
     - fallback only `he -> en`
     - if requested locale is `en`, do not fallback to `he`
  4. Fetch formula-sheet docs with `overrideAccess: true` (intentional privileged read), but return a whitelisted DTO only.
  5. Empty-content rule:
     - if selected sheet resolves but has empty richText content (and no valid PDF), return `null` (hide button)
  6. Missing PDF rule:
     - if selected PDF sheet references missing/invalid media, return DTO with `kind: 'pdf'` and `pdfStatus: 'missing'` to render error copy.
  7. Return DTO: `{ id, name, locale, kind, richText | pdfMedia, pdfStatus }`.

### API route (`route.ts`)
- `GET /api/formula-sheet?lessonId=xxx`
- Response: `{ formulaSheet: FormulaSheetDTO | null }`
- Uses `queryFormulaSheetForLesson` internally
- No auth required (formula sheets are visible to all users viewing published lessons)
- Derive locale from system locale (`getSystemLocale`) with optional `?locale=` override in tests
- Returns 400 if `lessonId` missing
- Returns 200 with `{ formulaSheet: null }` if no sheet found

**Tests** (integration test — `tests/int/formula-sheets.int.spec.ts`):

- **Test 9**: `should resolve lesson-level formula sheet` — Creates course, chapter, lesson with formulaSheet set. Calls query function. Asserts returns the lesson's sheet (not course default).
- **Test 10**: `should fall back to course default when lesson has no sheet` — Creates course with defaultFormulaSheet, chapter, lesson (no formulaSheet). Calls query. Asserts returns course's default sheet.
- **Test 11**: `should return null when neither lesson nor course has a sheet` — Creates lesson/course without any sheets. Calls query. Asserts returns null.
- **Test 12**: `should handle locale fallback he -> en` — Creates formula sheet with locale 'en' only. Queries with locale 'he'. Asserts returns the 'en' sheet.
- **Test 13**: `should not fallback en -> he` — Creates sheet only in `he`, queries locale `en`, asserts null.
- **Test 14**: `should hide when linked richText sheet is empty` — Linked sheet has empty content and no PDF, asserts null.
- **Test 15**: `should expose missing-pdf status for linked broken pdf sheet` — Linked PDF relation missing/invalid, asserts DTO indicates missing PDF.

**Acceptance Criteria**:
- [ ] Query resolves lesson → course precedence correctly
- [ ] Locale fallback works exactly: he → en → null (no en → he fallback)
- [ ] Public API only resolves sheets for published lessons
- [ ] Privileged formula-sheet reads expose only whitelisted response fields
- [ ] API returns proper JSON response with formula sheet data
- [ ] API returns 400 for missing lessonId
- [ ] Uses `depth: 0` for efficient queries (FR: NFR-001)

---

## Step 4: Create Formula Sheet Viewer UI Components

**Estimated time**: 25 minutes

**Files to Touch**:
- `src/ui/web/chat/FormulaSheetButton/index.tsx` (NEW) — The toggle button
- `src/ui/web/chat/FormulaSheetViewer/index.tsx` (NEW) — The viewer panel/drawer
- `src/ui/web/chat/lib/formula-sheet-richtext.ts` (NEW) — Lexical-to-markdown/text extraction for MathMarkdown
- `src/ui/web/chat/ChatInterface/index.tsx` (MODIFIED — lines 527-531, add toolbar with formula sheet button above input)
- `src/i18n/he.json` (MODIFIED — add translation keys under `courses`)
- `src/i18n/en.json` (MODIFIED — add translation keys under `courses`)
- `tests/e2e/formula-sheet-mobile.e2e.spec.ts` (NEW) — Mobile PDF zoom/scroll behavior

**Exact Behavior**:

### FormulaSheetButton
- Client component (`'use client'`)
- Props: `{ lessonId: string; disabled?: boolean }`
- Fetches formula sheet data via `GET /api/formula-sheet?lessonId=xxx` using `useSWR` or `useEffect+fetch`
- Shows loading skeleton while fetching
- If `null` result → renders nothing (button hidden) — satisfies "hide if no sheet"
- If sheet found → renders button with text "דף נוסחאות" (from i18n key `courses.formulaSheet`)
- On click → opens FormulaSheetViewer
- Icon: use `FileText` or `BookOpen` from lucide-react
- Keep viewer state fully local to the new components (no writes to chat hook state) to preserve chat draft/scroll

### FormulaSheetViewer
- Client component (`'use client'`)
- Props: `{ sheet: FormulaSheetData; isOpen: boolean; onClose: () => void }`
- On mobile (`< 768px`): full-screen drawer from bottom
- On desktop: modal/side panel overlay
- Content rendering:
  - If `sheet.richText` exists: render via `MathMarkdown` (after extracting markdown/text from Lexical), to guarantee LaTeX rendering per spec
  - If `sheet.pdfFile` exists: render via existing `PDFMedia` component
  - If pdfFile is set but file is missing/broken: show "Formula sheet could not be loaded." error message
- Close button in header
- Loading skeleton while content loads

### ChatInterface Integration
- Add `lessonId` prop pass-through (already exists)
- Insert a toolbar `div` between the "Chat Error Surface" section and the "Input Container" section (or above the input container)
- The toolbar contains `<FormulaSheetButton lessonId={lessonId} />` when `lessonId` is provided
- Opening/closing viewer must NOT affect chat state (input value, scroll position, messages)

### i18n Keys
Add to both `he.json` and `en.json` under `courses`:
- `formulaSheet`: "דף נוסחאות" / "Formula Sheet"
- `formulaSheetClose`: "סגור" / "Close"
- `formulaSheetError`: "לא ניתן לטעון את דף הנוסחאות." / "Formula sheet could not be loaded."
- `formulaSheetLoading`: "טוען דף נוסחאות..." / "Loading formula sheet..."

**Tests** (unit tests — FAIL before, PASS after):

- **Test file**: `tests/unit/components/chat/FormulaSheetButton.test.tsx` (NEW)
- **Test 16**: `should render nothing when no formula sheet exists` — Mock fetch to return `{ formulaSheet: null }`. Render `<FormulaSheetButton lessonId="123" />`. Assert nothing is rendered in DOM.
- **Test 17**: `should render button when formula sheet exists` — Mock fetch to return valid sheet. Assert button with text "Formula Sheet" is visible.
- **Test 18**: `should not render when lessonId is not provided` — Render without lessonId. Assert nothing renders.

- **Test file**: `tests/unit/components/chat/FormulaSheetViewer.test.tsx` (NEW)
- **Test 19**: `should render rich text content with MathMarkdown when sheet has content` — Pass richText sheet. Assert `MathMarkdown` rendering path is used.
- **Test 20**: `should render PDF viewer when sheet has pdfFile` — Pass sheet with pdfFile. Assert PDFMedia component or iframe is rendered.
- **Test 21**: `should show error when pdfFile is missing/invalid` — Pass sheet with missing PDF status. Assert error message displays.
- **Test 22**: `closing viewer preserves chat input value` — Type in chat input, open/close viewer, assert input unchanged.
- **Test 23**: `opening/closing viewer preserves message scroll position` — Set scroll container state, open/close viewer, assert unchanged.

- **Test file**: `tests/e2e/formula-sheet-mobile.e2e.spec.ts` (NEW)
- **Test 24**: `mobile PDF viewer supports zoom and scroll` — Open formula sheet on mobile viewport with PDF content, verify pinch/zoom controls and vertical scrolling work.

**Acceptance Criteria**:
- [ ] "דף נוסחאות" button appears in chat toolbar when a formula sheet is available
- [ ] Button is hidden when no formula sheet is linked (neither lesson nor course)
- [ ] Viewer opens without affecting chat state (input, scroll, messages)
- [ ] Rich text content renders with LaTeX support via MathMarkdown
- [ ] PDF content renders using existing PDFMedia component
- [ ] Mobile: viewer opens as full-screen drawer
- [ ] Desktop: viewer opens as modal/panel
- [ ] Loading skeleton shown while fetching
- [ ] Error message shown for broken PDF
- [ ] Mobile PDF supports zoom and scroll interactions
- [ ] All strings use i18n translation keys

---

## Step 5: Pass Formula Sheet Context From Lesson Page to ChatInterface

**Estimated time**: 15 minutes

**Files to Touch**:
- No code changes expected (verification-only step).
- If any missing `lessonId` wiring is found, update:
  - `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`
  - `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`

**Exact Behavior**:
- Verify all lesson-surface `<ChatInterface>` instances already pass `lessonId={lesson.id}` and keep this unchanged
- The `FormulaSheetButton` inside `ChatInterface` uses `lessonId` to fetch the appropriate formula sheet via the API
- No server-side pre-fetching needed — the button does client-side fetching

**Tests**: Covered by Step 3 resolver tests and Step 4 UI tests (no additional new test file in this step).

**Acceptance Criteria**:
- [ ] All ChatInterface instances on lesson pages have `lessonId` prop
- [ ] Formula sheet button fetches and displays correctly in both ExercisesPager and direct lesson views
- [ ] Lesson-level override correctly replaces course-level default (spec acceptance criteria)

---

## Step 6: Data Migration Script for Course 471 (FR-004)

**Estimated time**: 10 minutes

**Files to Touch**:
- `src/server/payload/migrations/seedFormulaSheet471.ts` (NEW)

**Exact Behavior**:
- Create an idempotent migration script that:
  1. Checks if a formula sheet named "471 - נוסחאות - v1" already exists
  2. If not, creates a new FormulaSheet document with:
     - `name`: "471 - נוסחאות - v1"
      - `content`: Actual Figma-provided richText payload for 471 sheet
      - `locale`: "he"
  3. Finds the course with courseLabel matching "471" or title containing "471"
  4. Links the formula sheet as `defaultFormulaSheet` on that course
- Export a `seedFormulaSheet471` function that takes `payload` instance
- Wire into `payload.config.ts` `onInit` after `runBackfillOnInit` with idempotent guards

**Tests** (integration test — `tests/int/formula-sheets.int.spec.ts`):

- **Test 25**: `migration should be idempotent` — Run migration twice. Assert only one formula sheet named "471 - נוסחאות - v1" exists after both runs.
- **Test 26**: `migration should attach non-empty Figma content` — Assert created sheet has non-empty content payload.

**Acceptance Criteria**:
- [ ] Migration creates formula sheet for course 471
- [ ] Migration is idempotent (running twice doesn't create duplicates)
- [ ] Formula sheet linked to course 471 as `defaultFormulaSheet`
- [ ] Migration can be safely called from `onInit`

---

## Step 7: Run Type Generation and Quality Checks

**Estimated time**: 5 minutes

**Files to Touch**:
- `src/payload-types.ts` (AUTO-GENERATED)

**Exact Behavior**:
- Run `pnpm generate:types` to regenerate types with new FormulaSheets collection
- Run `pnpm generate:importmap` to update admin import map
- Run `pnpm -s tsc --noEmit` to verify TypeScript correctness
- Run `pnpm lint` to verify linting passes
- Run focused tests:
  - `pnpm test:int -- --grep "formula-sheet|471"`
  - `pnpm test:unit -- tests/unit/components/chat/FormulaSheetButton.test.tsx tests/unit/components/chat/FormulaSheetViewer.test.tsx`
  - `pnpm test:e2e -- tests/e2e/formula-sheet-mobile.e2e.spec.ts`

**Tests**: No new tests. This step validates all previous work compiles.

**Acceptance Criteria**:
- [ ] `payload-types.ts` includes `FormulaSheet` type
- [ ] TypeScript compilation passes with no errors
- [ ] Lint passes
- [ ] All integration tests pass: `pnpm test:int -- --grep "formula-sheet"`

---

## Test Summary

| # | Test Name | Type | File |
|---|-----------|------|------|
| 1 | Create formula sheet with name and content | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 2 | Enforce admin-only access on create | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 3 | Allow pdfFile relationship to media | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 4 | Reject invalid naming pattern | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 5 | Reject PDF larger than 5MB | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 6 | Reject empty source (no content/no PDF) | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 7 | Link formula sheet to lesson | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 8 | Link default formula sheet to course | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 9 | Resolve lesson-level formula sheet | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 10 | Fall back to course default | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 11 | Return null when no sheet exists | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 12 | Locale fallback he→en | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 13 | No fallback en→he | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 14 | Hide linked empty richText sheet | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 15 | Missing PDF status for broken link | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 16 | Render nothing when no formula sheet | Unit | `tests/unit/components/chat/FormulaSheetButton.test.tsx` |
| 17 | Render button when formula sheet exists | Unit | `tests/unit/components/chat/FormulaSheetButton.test.tsx` |
| 18 | No render without lessonId | Unit | `tests/unit/components/chat/FormulaSheetButton.test.tsx` |
| 19 | Render rich text with MathMarkdown | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 20 | Render PDF viewer | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 21 | Show error for broken PDF | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 22 | Preserve chat input on viewer close | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 23 | Preserve chat scroll on viewer close | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 24 | Mobile PDF supports zoom and scroll | E2E | `tests/e2e/formula-sheet-mobile.e2e.spec.ts` |
| 25 | Migration idempotency | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 26 | Migration seeds non-empty 471 content | Integration | `tests/int/formula-sheets.int.spec.ts` |

## Spec Requirements Traceability

| Spec Req | Plan Step |
|----------|-----------|
| FR-001: FormulaSheets Collection | Step 1 |
| FR-002: Lesson Formula Sheet Field | Step 2 |
| FR-003: Course Default Formula Sheet Field | Step 2 |
| FR-004: Data Migration | Step 6 |
| Visibility & Access: Button hidden when no sheet | Step 3 + Step 4 (Tests 11, 16, 18) |
| Content Precedence: Lesson > Course > None | Step 3 (Tests 9, 10, 11) |
| Locale Fallback: he → en → hide | Step 3 (Tests 12, 13) |
| Interaction: No chat disruption | Step 4 (Tests 22, 23) |
| Content Formats: RichText + PDF | Step 4 (Tests 19, 20, 24) |
| Edge Cases: Missing PDF | Step 3 + Step 4 (Tests 15, 21) |
| Edge Cases: Empty RichText hides button | Step 3 (Test 14) |
| NFR-001: Performance (depth=0) | Step 3 |
| NFR-002: Localization (i18n keys) | Step 4 |
