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
- Rich text content rendering uses Payload's `RichText` component for Lexical output (not MathMarkdown, since Lexical is the format stored)
- For PDF rendering, the existing `PDFMedia` component at `src/ui/web/media/PDFMedia/index.tsx` is reused
- The migration script (Step 5) is deferred and can be a placeholder since actual Figma content is not available programmatically

---

## Step 1: Create FormulaSheets Collection (FR-001)

**Estimated time**: 15 minutes

**Files to Touch**:
- `src/server/payload/collections/FormulaSheets.ts` (NEW)
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
- Enable timestamps
- Register in `payload.config.ts` collections array

**Tests** (integration test — FAIL before, PASS after):

- **Test file**: `tests/int/formula-sheets.int.spec.ts` (NEW)
- **Test 1**: `should create a formula sheet with name and content` — Creates a formula sheet via `payload.create({ collection: 'formula-sheets', data: { name: '471 - Calc - v1' }, overrideAccess: true })`. Asserts doc has `name`, `id`, `locale` defaults to 'he'.
- **Test 2**: `should enforce admin-only access on create` — Attempts `payload.create({ collection: 'formula-sheets', data: {...}, user: studentUser, overrideAccess: false })`. Expects rejection/forbidden.
- **Test 3**: `should allow pdfFile relationship to media` — Creates a formula sheet with `pdfFile` set to a media doc ID. Asserts the relationship is saved correctly.

**Acceptance Criteria**:
- [ ] FormulaSheets collection exists with slug `formula-sheets`
- [ ] All CRUD operations restricted to admin role
- [ ] `name` field is required, `content` and `pdfFile` are optional
- [ ] `locale` defaults to 'he' and accepts 'he'|'en'
- [ ] `tenant` auto-populates via existing tenant hook
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

- **Test 4**: `should link formula sheet to lesson` — Creates a formula sheet, then creates a lesson with `formulaSheet: sheetId`. Fetches lesson and asserts `formulaSheet` equals the sheet ID.
- **Test 5**: `should link default formula sheet to course` — Creates a formula sheet, then creates a course with `defaultFormulaSheet: sheetId`. Fetches course and asserts `defaultFormulaSheet` equals the sheet ID.

**Acceptance Criteria**:
- [ ] Lessons collection has optional `formulaSheet` relationship field
- [ ] Courses collection has optional `defaultFormulaSheet` relationship field
- [ ] Both fields appear in admin sidebar
- [ ] Type generation succeeds (`pnpm generate:types`)
- [ ] Existing lessons/courses without the field continue to work (optional field)

---

## Step 3: Create Formula Sheet Data-Fetching Query and API Endpoint

**Estimated time**: 20 minutes

**Files to Touch**:
- `src/server/repos/queries/formula-sheets.ts` (NEW)
- `src/app/api/formula-sheet/route.ts` (NEW)

**Exact Behavior**:

### Query function (`formula-sheets.ts`)
- `queryFormulaSheetForLesson({ lessonId, locale })`:
  1. Fetch lesson by ID with `depth: 0` → get `formulaSheet` ID
  2. If lesson has `formulaSheet`, fetch formula sheet by ID
  3. If not, get lesson's chapter → chapter's course → course's `defaultFormulaSheet`
  4. If formula sheet found, check its `locale` matches requested locale
  5. Locale fallback: if sheet not found for `locale`, try other locale ('he' → 'en' or 'en' → 'he')
  6. If no sheet found at all, return `null`
  7. Return formula sheet data: `{ id, name, content, pdfFile, locale }`

### API route (`route.ts`)
- `GET /api/formula-sheet?lessonId=xxx`
- Response: `{ formulaSheet: { id, name, content, pdfFile, locale } | null }`
- Uses `queryFormulaSheetForLesson` internally
- No auth required (formula sheets are visible to all users viewing published lessons)
- Returns 400 if `lessonId` missing
- Returns 200 with `{ formulaSheet: null }` if no sheet found

**Tests** (integration test — `tests/int/formula-sheets.int.spec.ts`):

- **Test 6**: `should resolve lesson-level formula sheet` — Creates course, chapter, lesson with formulaSheet set. Calls query function. Asserts returns the lesson's sheet (not course default).
- **Test 7**: `should fall back to course default when lesson has no sheet` — Creates course with defaultFormulaSheet, chapter, lesson (no formulaSheet). Calls query. Asserts returns course's default sheet.
- **Test 8**: `should return null when neither lesson nor course has a sheet` — Creates lesson/course without any sheets. Calls query. Asserts returns null.
- **Test 9**: `should handle locale fallback` — Creates formula sheet with locale 'en' only. Queries with locale 'he'. Asserts returns the 'en' sheet as fallback.

**Acceptance Criteria**:
- [ ] Query resolves lesson → course precedence correctly
- [ ] Locale fallback works: he → en → null
- [ ] API returns proper JSON response with formula sheet data
- [ ] API returns 400 for missing lessonId
- [ ] Uses `depth: 0` for efficient queries (FR: NFR-001)

---

## Step 4: Create Formula Sheet Viewer UI Components

**Estimated time**: 25 minutes

**Files to Touch**:
- `src/ui/web/chat/FormulaSheetButton/index.tsx` (NEW) — The toggle button
- `src/ui/web/chat/FormulaSheetViewer/index.tsx` (NEW) — The viewer panel/drawer
- `src/ui/web/chat/ChatInterface/index.tsx` (MODIFIED — lines 527-531, add toolbar with formula sheet button above input)
- `src/i18n/he.json` (MODIFIED — add translation keys under `courses`)
- `src/i18n/en.json` (MODIFIED — add translation keys under `courses`)

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

### FormulaSheetViewer
- Client component (`'use client'`)
- Props: `{ sheet: FormulaSheetData; isOpen: boolean; onClose: () => void }`
- On mobile (`< 768px`): full-screen drawer from bottom
- On desktop: modal/side panel overlay
- Content rendering:
  - If `sheet.content` exists (richText): render via Payload's `RichText` component or serialized Lexical output. Since we're rendering Lexical rich text on the frontend, use the existing RichText serializer.
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
- **Test 10**: `should render nothing when no formula sheet exists` — Mock fetch to return `{ formulaSheet: null }`. Render `<FormulaSheetButton lessonId="123" />`. Assert nothing is rendered in DOM.
- **Test 11**: `should render button when formula sheet exists` — Mock fetch to return valid sheet. Assert button with text "Formula Sheet" is visible.
- **Test 12**: `should not render when lessonId is not provided` — Render without lessonId. Assert nothing renders.

- **Test file**: `tests/unit/components/chat/FormulaSheetViewer.test.tsx` (NEW)
- **Test 13**: `should render rich text content when sheet has content` — Pass sheet with content. Assert content area is rendered.
- **Test 14**: `should render PDF viewer when sheet has pdfFile` — Pass sheet with pdfFile. Assert PDFMedia component or iframe is rendered.
- **Test 15**: `should show error when pdfFile is missing/invalid` — Pass sheet with pdfFile but broken URL. Assert error message displays.

**Acceptance Criteria**:
- [ ] "דף נוסחאות" button appears in chat toolbar when a formula sheet is available
- [ ] Button is hidden when no formula sheet is linked (neither lesson nor course)
- [ ] Viewer opens without affecting chat state (input, scroll, messages)
- [ ] Rich text content renders with LaTeX support
- [ ] PDF content renders using existing PDFMedia component
- [ ] Mobile: viewer opens as full-screen drawer
- [ ] Desktop: viewer opens as modal/panel
- [ ] Loading skeleton shown while fetching
- [ ] Error message shown for broken PDF
- [ ] All strings use i18n translation keys

---

## Step 5: Pass Formula Sheet Context From Lesson Page to ChatInterface

**Estimated time**: 15 minutes

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — pass `lessonId` to ChatInterface, already done in most places)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (MODIFIED — ensure `lessonId` is passed through)

**Exact Behavior**:
- Verify all `<ChatInterface>` instances in lesson page pass `lessonId={lesson.id}` (most already do)
- The `FormulaSheetButton` inside `ChatInterface` uses `lessonId` to fetch the appropriate formula sheet via the API
- No server-side pre-fetching needed — the button does client-side fetching

**Tests** (integration test — `tests/int/formula-sheets.int.spec.ts`):

- **Test 16**: `should resolve formula sheet through full lesson→chapter→course hierarchy` — Creates full hierarchy: course with `defaultFormulaSheet`, chapter, lesson. Uses query function to verify correct sheet is resolved through the chain.

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
     - `content`: Placeholder richText content (actual content from Figma to be added manually by admin later)
     - `locale`: "he"
  3. Finds the course with courseLabel matching "471" or title containing "471"
  4. Links the formula sheet as `defaultFormulaSheet` on that course
- Export a `seedFormulaSheet471` function that takes `payload` instance
- Can be called from `payload.config.ts` `onInit` or run manually

**Tests** (integration test — `tests/int/formula-sheets.int.spec.ts`):

- **Test 17**: `migration should be idempotent` — Run migration twice. Assert only one formula sheet named "471 - נוסחאות - v1" exists after both runs.

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
| 4 | Link formula sheet to lesson | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 5 | Link default formula sheet to course | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 6 | Resolve lesson-level formula sheet | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 7 | Fall back to course default | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 8 | Return null when no sheet exists | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 9 | Handle locale fallback | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 10 | Render nothing when no formula sheet | Unit | `tests/unit/components/chat/FormulaSheetButton.test.tsx` |
| 11 | Render button when formula sheet exists | Unit | `tests/unit/components/chat/FormulaSheetButton.test.tsx` |
| 12 | No render without lessonId | Unit | `tests/unit/components/chat/FormulaSheetButton.test.tsx` |
| 13 | Render rich text content | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 14 | Render PDF viewer | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 15 | Show error for broken PDF | Unit | `tests/unit/components/chat/FormulaSheetViewer.test.tsx` |
| 16 | Full hierarchy resolution | Integration | `tests/int/formula-sheets.int.spec.ts` |
| 17 | Migration idempotency | Integration | `tests/int/formula-sheets.int.spec.ts` |

## Spec Requirements Traceability

| Spec Req | Plan Step |
|----------|-----------|
| FR-001: FormulaSheets Collection | Step 1 |
| FR-002: Lesson Formula Sheet Field | Step 2 |
| FR-003: Course Default Formula Sheet Field | Step 2 |
| FR-004: Data Migration | Step 6 |
| Visibility & Access: Button hidden when no sheet | Step 4 (Tests 10, 12) |
| Content Precedence: Lesson > Course > None | Step 3 (Tests 6, 7, 8) |
| Locale Fallback: he → en → hide | Step 3 (Test 9) |
| Interaction: No chat disruption | Step 4 |
| Content Formats: RichText + PDF | Step 4 (Tests 13, 14) |
| Edge Cases: Missing PDF | Step 4 (Test 15) |
| NFR-001: Performance (depth=0) | Step 3 |
| NFR-002: Localization (i18n keys) | Step 4 |
