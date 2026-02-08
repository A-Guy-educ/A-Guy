# PDF Conversion Page - Detailed Implementation Plan

## Problem

The current PDF conversion UI is a `ui` field crammed inside the Lesson edit form (`src/server/payload/collections/Lessons.ts:156-165`). Three specific UX issues:

1. **Cramped inline UI** -- The `LessonConversionPanel` is squeezed into a small UI field panel inside the Lesson edit form with tiny 11-12px text and compact controls
2. **Poor job monitoring** -- Status polling is basic (10s interval), no history of past jobs, no error details, no way to see jobs across lessons
3. **Awkward draft review** -- Viewing created exercises requires expanding inline lists and clicking through one by one in a minimal list

## Solution

A dedicated admin page at `/admin/pdf-conversion` following the established `admin/chat` page pattern, with a **convert-first** layout, proper job monitoring, and exercise review cards.

## Architecture

Follows the existing `admin/chat` pattern (see `src/app/(payload)/admin/chat/page.tsx`):

1. Next.js page at `src/app/(payload)/admin/pdf-conversion/page.tsx`
2. Sidebar nav link via `beforeNavLinks` in `payload.config.ts`
3. Client components in `src/ui/admin/PdfConversion/`
4. Uses Payload CSS variables and admin styling conventions
5. Auth via `useCurrentUser()` hook from `src/client/hooks/useCurrentUser.ts`

## Page Layout

```
+-------------------------------------------------------------+
|  PDF Conversion                                             |
+--------------------------+----------------------------------+
|                          |                                  |
|  CONVERSION FORM         |  JOB HISTORY & RESULTS           |
|                          |                                  |
|  1. Select Lesson v      |  +-----------------------------+ |
|     (searchable select)  |  | Job: math-101.pdf           | |
|                          |  | Status: * COMPLETED         | |
|  2. Select PDF v         |  | 5/5 segments - 12 exercises | |
|     (auto-populated      |  | [View Exercises] [Re-run]   | |
|      from lesson files)  |  +-----------------------------+ |
|                          |  | Job: physics-ch3.pdf        | |
|  3. Extractor Prompt v   |  | Status: * RUNNING  [60%]   | |
|  4. Verifier Prompt  v   |  | 3/5 segments - 6 exercises  | |
|  5. Diagram Gen (opt) v  |  +-----------------------------+ |
|                          |  | Job: algebra-hw.pdf         | |
|  [Start Conversion]      |  | Status: * FAILED            | |
|                          |  | Error: Prompt too large      | |
|                          |  | [View Details] [Retry]      | |
|                          |  +-----------------------------+ |
|                          |                                  |
|                          |  -- Exercises from selected --   |
|                          |  +-----------------------------+ |
|                          |  | Ex 1: "Find derivative..."  | |
|                          |  | Pages 1-2 - Draft           | |
|                          |  | [Open in Editor]            | |
|                          |  | Ex 2: "Solve integral..."   | |
|                          |  | Pages 3-4 - Draft           | |
|                          |  | [Open in Editor]            | |
|                          |  +-----------------------------+ |
+--------------------------+----------------------------------+
```

---

## Implementation Steps

### Phase 0: Setup

**Branch**: `feat/pdf-conversion-page` off `dev`

### Phase 1: Backend - Make Status Endpoint Support "All Jobs" Listing

The current status endpoint (`src/app/api/exercises/convert/status/route.ts`) requires `lessonId` and `mediaId` as mandatory query params via `jobStatusQuerySchema`. We need to make them optional so the new page can fetch all recent jobs.

#### Step 1.1: Update Zod Schema

**File**: `src/server/api/schemas/job-schemas.ts`

Current `jobStatusQuerySchema` requires `lessonId` and `mediaId`. Change both to `.optional()`:

```typescript
export const jobStatusQuerySchema = z.object({
  lessonId: objectIdSchema.optional(),
  mediaId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10), // Change default from 1 to 10
})
```

This is backward-compatible -- existing callers passing both params still work identically.

#### Step 1.2: Update Status Route Handler

**File**: `src/app/api/exercises/convert/status/route.ts`

The `JobService.findByContext()` method already handles `undefined` values in the context object (it only adds filters for truthy keys -- see `job-service.ts:92-94`). So the route handler needs no logic changes. The Zod schema change alone is sufficient.

#### Step 1.3: Test the Schema Change

**File**: `tests/unit/api/schemas/job-schemas.spec.ts` (existing file)

Add tests for the updated schema:

```typescript
describe('jobStatusQuerySchema - optional params', () => {
  it('accepts empty query (all jobs)', () => {
    const result = jobStatusQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data.limit).toBe(10)
  })

  it('accepts only lessonId', () => {
    const result = jobStatusQuerySchema.safeParse({ lessonId: '507f1f77bcf86cd799439011' })
    expect(result.success).toBe(true)
    expect(result.data.mediaId).toBeUndefined()
  })

  it('still accepts both params (backward compat)', () => {
    const result = jobStatusQuerySchema.safeParse({
      lessonId: '507f1f77bcf86cd799439011',
      mediaId: '507f1f77bcf86cd799439012',
    })
    expect(result.success).toBe(true)
  })
})
```

---

### Phase 2: Page Wiring & Navigation

#### Step 2.1: Create Sidebar Nav Link

**File**: `src/ui/admin/PdfConversion/SidebarLink/index.tsx`

Follow the exact pattern of `src/ui/admin/AdminChat/SidebarLink/index.tsx`:

```typescript
'use client'
import Link from 'next/link'
import React from 'react'

export const PdfConversionSidebarLink: React.FC = () => {
  return (
    <li className="nav__item">
      <Link href="/admin/pdf-conversion" className="nav__link">
        <span className="nav__label">PDF Conversion</span>
      </Link>
    </li>
  )
}
export default PdfConversionSidebarLink
```

#### Step 2.2: Register in Payload Config

**File**: `src/payload.config.ts`

Add to `beforeNavLinks` array (line 81):

```typescript
beforeNavLinks: [
  '@/ui/admin/AdminChat/SidebarLink',
  '@/ui/admin/PdfConversion/SidebarLink',
],
```

#### Step 2.3: Create Page Route

**File**: `src/app/(payload)/admin/pdf-conversion/page.tsx`

Follow the `admin/chat/page.tsx` pattern:

```typescript
'use client'
import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { PdfConversionPage } from '@/ui/admin/PdfConversion/PdfConversionPage'

export default function AdminPdfConversionPage() {
  const { user, isLoading } = useCurrentUser()

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>
  }
  if (!user) {
    return <div style={{ padding: 20 }}>Please log in to access PDF conversion</div>
  }
  // Admin-only check
  if (user.role !== 'admin') {
    return <div style={{ padding: 20 }}>Admin access required</div>
  }

  return <PdfConversionPage />
}
```

#### Step 2.4: Regenerate Import Map

```bash
pnpm payload generate:importmap
```

---

### Phase 3: Main Page Layout Component

#### Step 3.1: Create Page Component

**File**: `src/ui/admin/PdfConversion/PdfConversionPage/index.tsx`

Two-column layout. Manages shared state:

- `selectedLessonId: string | null`
- `selectedMediaId: string | null`
- `selectedJobId: string | null`
- `refreshKey: number` (incremented after successful queue to trigger job list refresh)

```typescript
'use client'
import { useState, useCallback } from 'react'
import { ConversionForm } from '../ConversionForm'
import { JobHistory } from '../JobHistory'
import { ExerciseReview } from '../ExerciseReview'
import './index.scss'

export function PdfConversionPage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleConversionQueued = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="pdf-conversion-page">
      <h1 className="pdf-conversion-page__title">PDF Conversion</h1>
      <div className="pdf-conversion-page__layout">
        <div className="pdf-conversion-page__left">
          <ConversionForm onQueued={handleConversionQueued} />
        </div>
        <div className="pdf-conversion-page__right">
          <JobHistory
            refreshKey={refreshKey}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
          {selectedJobId && (
            <ExerciseReview jobId={selectedJobId} />
          )}
        </div>
      </div>
    </div>
  )
}
```

#### Step 3.2: Create SCSS Styles

**File**: `src/ui/admin/PdfConversion/PdfConversionPage/index.scss`

```scss
.pdf-conversion-page {
  padding: var(--base);
  max-width: 1400px;

  &__title {
    font-size: 24px;
    font-weight: 600;
    color: var(--theme-text);
    margin-bottom: var(--base);
  }

  &__layout {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: var(--base);
    align-items: start;
  }

  &__left {
    position: sticky;
    top: var(--base);
  }

  &__right {
    display: flex;
    flex-direction: column;
    gap: var(--base);
  }
}

// Responsive: stack on narrow screens
@media (max-width: 900px) {
  .pdf-conversion-page__layout {
    grid-template-columns: 1fr;
  }

  .pdf-conversion-page__left {
    position: static;
  }
}
```

---

### Phase 4: Conversion Form (Left Panel)

#### Step 4.1: Create LessonSelector

**File**: `src/ui/admin/PdfConversion/LessonSelector/index.tsx`

Searchable text input that fetches from `/api/lessons?where[title][contains]=<query>&limit=10&depth=1`.

Props:

- `selectedLessonId: string | null`
- `onSelectLesson: (lessonId: string, lesson: LessonOption) => void`

Behavior:

- Text input with 300ms debounce
- Dropdown of results showing: lesson title + parent chapter title (if depth=1 populates it)
- Clicking a result selects it and collapses the dropdown
- Shows selected lesson name when not searching

#### Step 4.2: Create PdfSelector

**File**: `src/ui/admin/PdfConversion/PdfSelector/index.tsx`

Props:

- `lessonId: string`
- `selectedMediaId: string | null`
- `onSelectMedia: (mediaId: string) => void`

Behavior:

- On mount / when `lessonId` changes, fetches lesson's `contentFiles` via `/api/lessons/<id>?depth=1`
- Filters for `mimeType === 'application/pdf'`
- Renders as a list of radio-style selectable items showing filename
- If no PDFs found, shows "No PDFs attached to this lesson" message

#### Step 4.3: Create ConversionForm

**File**: `src/ui/admin/PdfConversion/ConversionForm/index.tsx`

Orchestrates LessonSelector + PdfSelector + prompt dropdowns + submit.

Props:

- `onQueued: () => void` -- callback when a job is successfully queued

State:

- `selectedLessonId`, `selectedMediaId`
- `extractorPromptId`, `verifierPromptId`, `diagramPromptId`
- `isSubmitting`, `error`, `success`

Prompt loading:

- When `selectedLessonId` changes, fetch prompts from `/api/prompts/for-conversion` (POST with `{ lessonId }`)
- Populate 3 select dropdowns: Extractor (required), Verifier (required), Diagram Generator (optional)
- Each dropdown shows prompt `title`

Submit:

- POST to `/api/exercises/convert/queue` with `{ lessonId, mediaId, extractorPromptId, verifierPromptId, diagramPromptId }`
- On success: show success message, call `onQueued()`, reset form state after 2s
- On error: show error message from response

UI:

- Each form control has a proper `<label>` element
- Proper spacing, full-width controls
- Disabled state on submit button when missing required fields
- Loading states for prompt fetching

---

### Phase 5: Job History Panel (Right Panel, Top)

#### Step 5.1: Create JobHistory

**File**: `src/ui/admin/PdfConversion/JobHistory/index.tsx`

Props:

- `refreshKey: number` -- when this changes, re-fetch jobs
- `selectedJobId: string | null`
- `onSelectJob: (jobId: string) => void`

Behavior:

- On mount + when `refreshKey` changes, fetch from `/api/exercises/convert/status?limit=20`
- Poll: every 5s if any job is `queued` or `running`, otherwise every 30s
- Each job card shows:
  - Source filename (from `input.ctx.sourceDocId` -- need to resolve to media filename, or show ID prefix)
  - Status badge with color (reuse `getBadgeStyle` from existing `ConversionStatusPanel`)
  - Progress bar if `running`
  - Stats: `segmentsDone/segmentsTotal` segments, `exercisesCreated` exercises
  - Timestamp (`updatedAt` or `createdAt`)
  - **Actions**:
    - "Run Now" button for `queued`/`failed` jobs (POST to `/api/jobs/run-immediate`)
    - "View Exercises" button for `completed` jobs (sets `selectedJobId`)
- Error collapsible: if `output.errors` is non-empty, show expandable section with error list
- Selected job gets a highlight border

Note on filename resolution: The status endpoint returns `input.ctx.sourceDocId` (a media ID). To show the filename, the component will need to batch-fetch media records via `/api/media?where[id][in]=<ids>&select[filename]=true&limit=20`. This is done once after fetching jobs, not per-job.

---

### Phase 6: Exercise Review Panel (Right Panel, Bottom)

#### Step 6.1: Create ExerciseReview

**File**: `src/ui/admin/PdfConversion/ExerciseReview/index.tsx`

Props:

- `jobId: string`

Behavior:

- Fetch exercises from `/api/exercises?where[conversionJobId][equals]=<jobId>&limit=100&sort=sourceOrderInSegment`
- Render as a list of cards, each showing:
  - Title (truncated to ~80 chars)
  - Source pages: "Pages X-Y"
  - Status badge (draft/published)
  - "Open in Editor" link: `<a href="/admin/collections/exercises/<id>" target="_blank">`
- Empty state: "No exercises found for this job"
- Loading state while fetching

---

### Phase 7: Tests

All tests follow the project's existing patterns:

- Vitest with `// @vitest-environment jsdom` for component tests
- `@testing-library/react` for rendering and assertions
- `vi.mock()` for module mocking
- File naming: `*.spec.tsx` for components, `*.spec.ts` for logic

#### Test 7.1: Schema Change

**File**: `tests/unit/api/schemas/job-schemas.spec.ts` (modify existing)

Add test cases for optional `lessonId`/`mediaId` in `jobStatusQuerySchema`:

- `{}` -> success, limit defaults to 10
- `{ lessonId: validId }` -> success, mediaId undefined
- `{ mediaId: validId }` -> success, lessonId undefined
- `{ lessonId: validId, mediaId: validId }` -> success (backward compat)
- `{ lessonId: 'bad' }` -> fail (invalid ObjectId still rejected)

#### Test 7.2: SidebarLink Component

**File**: `tests/unit/components/pdf-conversion/SidebarLink.spec.tsx`

```
- renders a nav link to /admin/pdf-conversion
- has correct Payload nav CSS classes (nav__item, nav__link, nav__label)
- displays "PDF Conversion" label text
```

Mocks: `next/link` (or verify href attribute directly)

#### Test 7.3: PdfConversionPage Layout

**File**: `tests/unit/components/pdf-conversion/PdfConversionPage.spec.tsx`

```
- renders page title "PDF Conversion"
- renders the conversion form section
- renders the job history section
- does not render exercise review when no job selected
```

Mocks: All child components mocked via `vi.mock()`:

- `vi.mock('@/ui/admin/PdfConversion/ConversionForm', ...)`
- `vi.mock('@/ui/admin/PdfConversion/JobHistory', ...)`
- `vi.mock('@/ui/admin/PdfConversion/ExerciseReview', ...)`

#### Test 7.4: LessonSelector

**File**: `tests/unit/components/pdf-conversion/LessonSelector.spec.tsx`

```
- renders search input
- shows loading state while fetching
- displays lesson results on search
- calls onSelectLesson when a result is clicked
- shows selected lesson name
- debounces search input (does not fetch on every keystroke)
```

Mocks: `global.fetch` to mock `/api/lessons` responses

#### Test 7.5: PdfSelector

**File**: `tests/unit/components/pdf-conversion/PdfSelector.spec.tsx`

```
- shows loading state on mount
- fetches lesson media and filters for PDFs
- renders PDF filenames as selectable items
- calls onSelectMedia when a PDF is clicked
- shows "No PDFs" message when lesson has no PDF files
- highlights selected PDF
```

Mocks: `global.fetch` to mock `/api/lessons/<id>` response with contentFiles

#### Test 7.6: ConversionForm

**File**: `tests/unit/components/pdf-conversion/ConversionForm.spec.tsx`

```
- renders all form sections (lesson, pdf, prompts, submit)
- submit button is disabled when required fields are missing
- submit button is disabled while submitting
- calls onQueued after successful submission
- shows error message on failed submission
- shows success message after queueing
- loads prompts when lesson is selected
```

Mocks:

- `global.fetch` for `/api/prompts/for-conversion` and `/api/exercises/convert/queue`
- Child components (LessonSelector, PdfSelector) mocked or rendered

#### Test 7.7: JobHistory

**File**: `tests/unit/components/pdf-conversion/JobHistory.spec.tsx`

```
- shows loading state initially
- renders job cards after fetch
- shows status badge with correct styling for each status
- shows progress bar for running jobs
- shows "Run Now" button for queued/failed jobs
- calls onSelectJob when "View Exercises" is clicked
- highlights selected job
- re-fetches when refreshKey changes
- shows empty state when no jobs exist
```

Mocks: `global.fetch` for `/api/exercises/convert/status` and `/api/media`

#### Test 7.8: ExerciseReview

**File**: `tests/unit/components/pdf-conversion/ExerciseReview.spec.tsx`

```
- shows loading state initially
- renders exercise cards after fetch
- shows exercise title, source pages, and status
- renders "Open in Editor" link with correct href
- shows empty state when no exercises found
```

Mocks: `global.fetch` for `/api/exercises` responses

#### Test 7.9: Page Route (auth gating)

**File**: `tests/unit/components/pdf-conversion/AdminPdfConversionPage.spec.tsx`

```
- shows loading state while auth is loading
- shows login prompt when user is null
- shows admin required message for non-admin users
- renders PdfConversionPage for admin users
```

Mocks:

- `vi.mock('@/client/hooks/useCurrentUser', ...)`
- `vi.mock('@/ui/admin/PdfConversion/PdfConversionPage', ...)`

---

### Phase 8: Verification

#### Step 8.1: TypeScript Check

```bash
pnpm tsc --noEmit
```

Must pass with zero errors.

#### Step 8.2: Lint

```bash
pnpm lint
```

Must pass. Fix any auto-fixable issues with `pnpm lint --fix`.

#### Step 8.3: Format

```bash
pnpm format:check
```

If fails, run `pnpm format` to fix.

#### Step 8.4: Unit Tests

```bash
pnpm test:unit
```

All existing + new tests must pass.

#### Step 8.5: Import Map

Verify `src/app/(payload)/admin/importMap.js` was regenerated and includes the new component paths.

#### Step 8.6: Manual Smoke Test Checklist

- [ ] Navigate to `/admin` -- sidebar shows "PDF Conversion" link
- [ ] Click link -- page loads, shows "PDF Conversion" title
- [ ] Non-admin user sees "Admin access required"
- [ ] Search for a lesson -- results appear, selecting one works
- [ ] Selected lesson shows its PDF files
- [ ] Selecting a PDF enables prompt dropdowns
- [ ] Prompts load correctly for the lesson's tenant
- [ ] Starting a conversion shows success, job appears in history
- [ ] Job history shows correct status badges
- [ ] Completed job "View Exercises" shows exercise cards
- [ ] "Open in Editor" links open exercise edit page in new tab
- [ ] Page is responsive -- stacks on narrow viewport

---

### Phase 9: Git & PR

#### Step 9.1: Commit Strategy

Single feature commit (or split if large):

```
feat: add dedicated PDF conversion admin page

Replace the cramped inline conversion panel with a full admin page at
/admin/pdf-conversion. Includes searchable lesson/PDF selection, prompt
configuration, job history with status monitoring, and exercise review cards.
```

#### Step 9.2: Create PR

```bash
gh pr create \
  --title "feat: dedicated PDF conversion admin page" \
  --body "$(cat <<'EOF'
## Summary
- Adds a new admin page at `/admin/pdf-conversion` for PDF-to-exercise conversion
- Searchable lesson selector, PDF file picker, and prompt configuration form
- Job history panel with status badges, progress bars, and error details
- Exercise review cards for completed conversions with links to exercise editor

## Changes
- **New page**: `src/app/(payload)/admin/pdf-conversion/page.tsx`
- **New components**: `src/ui/admin/PdfConversion/` (9 components)
- **Backend**: Made `lessonId`/`mediaId` optional in status endpoint schema (backward compatible)
- **Config**: Added sidebar nav link in `payload.config.ts`

## Testing
- Unit tests for all new components and schema changes
- Manual smoke test against dev environment

## Screenshots
(attach after implementation)
EOF
)"
```

---

## Files Summary

### Files to Create (11)

| File                                                      | Purpose                    |
| --------------------------------------------------------- | -------------------------- |
| `src/app/(payload)/admin/pdf-conversion/page.tsx`         | Page route (auth-gated)    |
| `src/ui/admin/PdfConversion/SidebarLink/index.tsx`        | Nav link                   |
| `src/ui/admin/PdfConversion/PdfConversionPage/index.tsx`  | Main two-column layout     |
| `src/ui/admin/PdfConversion/PdfConversionPage/index.scss` | Page styles                |
| `src/ui/admin/PdfConversion/LessonSelector/index.tsx`     | Searchable lesson picker   |
| `src/ui/admin/PdfConversion/PdfSelector/index.tsx`        | PDF file selector          |
| `src/ui/admin/PdfConversion/ConversionForm/index.tsx`     | Prompt config + submit     |
| `src/ui/admin/PdfConversion/JobHistory/index.tsx`         | Job list with status       |
| `src/ui/admin/PdfConversion/ExerciseReview/index.tsx`     | Exercise review cards      |
| `tests/unit/components/pdf-conversion/*.spec.tsx`         | 8 test files (see Phase 7) |

### Files to Modify (2)

| File                                    | Change                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| `src/payload.config.ts`                 | Add `'@/ui/admin/PdfConversion/SidebarLink'` to `beforeNavLinks` |
| `src/server/api/schemas/job-schemas.ts` | Make `lessonId`/`mediaId` optional, change default limit to 10   |

### Files NOT Modified

- `src/app/api/exercises/convert/status/route.ts` -- No code changes needed (schema change is sufficient)
- `src/app/api/exercises/convert/queue/route.ts` -- Unchanged
- `src/ui/admin/exercise-conversion/*` -- Existing inline panel stays as-is
- `src/server/payload/services/job-service.ts` -- Already handles optional context fields

## Not in Scope

- PDF preview/viewer on this page (could be added later)
- Standalone PDF conversion (no lesson)
- Batch operations (convert multiple PDFs at once)
- Changes to the conversion pipeline or prompts system
- E2E tests (would require full app + DB; can be added as follow-up)
