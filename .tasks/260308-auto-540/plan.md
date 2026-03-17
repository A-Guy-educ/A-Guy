# Plan: Prompt Selection for PDF-to-Exercise Conversion (V3)

**Task ID**: 260308-auto-540
**Type**: implement_feature
**Estimated Steps**: 3 (each 10-20 minutes)

## Summary

Add a prompt selection dropdown to the `ConvertV3Button` component so admins can choose an extractor prompt before triggering V3 conversion. The backend already accepts an optional `promptId` parameter — this is purely a UI feature. The existing `ConvertForm` component (used by V1) provides the exact pattern to follow.

## Assumptions

- No clarified.md exists; proceeding with spec.md as-is.
- The backend endpoint (`/api/exercises/convert/single`) already accepts `promptId` — no backend changes needed.
- The prompts API (`/api/prompts/for-conversion`) already returns `{ extractors: [], verifiers: [] }` — no API changes needed.
- The `ConvertV3Button` will be refactored from a simple button into a two-state component: collapsed (shows button) and expanded (shows prompt dropdown + convert button).
- V3 only needs extractor prompts (no verifier dropdown) per FR-3/FR-5.
- The prompt selection is optional — admin can still convert with default prompt by not selecting one.

## Architecture

```
LessonConversionPanel
  └── ConvertV3Button (MODIFIED)
        ├── Collapsed state: "Convert V3" button (click → expand)
        └── Expanded state:
              ├── Prompt dropdown (fetched from /api/prompts/for-conversion → extractors only)
              ├── "Convert" button (sends { lessonId, mediaId, promptId })
              └── "Cancel" button (collapse back)
```

---

## Step 1: Create `useExtractorPrompts` Hook

**Time**: ~10 minutes
**Requirement**: FR-4 (fetch prompts), NFR-1 (admin auth context), NFR-2 (error handling)

### Files to Touch

- `src/ui/admin/exercise-conversion/hooks/useExtractorPrompts.ts` (NEW)

### Behavior

- Custom React hook that fetches extractor prompts from `/api/prompts/for-conversion` via POST.
- Accepts `lessonId: string` parameter.
- Returns `{ extractorPrompts, isLoading, error, retry }`.
- Filters response to only return `extractors` array (ignores `verifiers`).
- Uses `credentials: 'include'` for admin auth context (NFR-1).
- Handles loading, error, and empty states (NFR-2).
- Provides a `retry` function to re-fetch on error.

### Interface

```typescript
interface PromptOption {
  id: string
  title: string
  promptKey: string
  usage: string
}

interface UseExtractorPromptsResult {
  extractorPrompts: PromptOption[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

function useExtractorPrompts(lessonId: string): UseExtractorPromptsResult
```

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/admin/exercise-conversion/hooks/useExtractorPrompts.test.tsx`

1. **Test: fetches extractor prompts on mount**
   - Mock `global.fetch` to return `{ extractors: [{ id: '1', title: 'Prompt A', promptKey: 'p-a', usage: 'extractor' }], verifiers: [] }`
   - Render hook with `lessonId: 'lesson-1'`
   - Assert: `fetch` called with POST to `/api/prompts/for-conversion`, body contains `{ lessonId: 'lesson-1' }`
   - Assert: `result.extractorPrompts` has 1 item with `id: '1'`
   - Assert: `result.isLoading` is `false` after fetch completes
   - Assert: `result.error` is `null`

2. **Test: handles fetch error and exposes retry**
   - Mock `global.fetch` to reject with network error
   - Render hook with `lessonId: 'lesson-1'`
   - Assert: `result.error` is `'Failed to load prompts'`
   - Assert: `result.extractorPrompts` is `[]`
   - Mock `global.fetch` to succeed on second call
   - Call `result.retry()`
   - Assert: `result.error` is `null`, `result.extractorPrompts` has items

### Acceptance Criteria

- [ ] Hook fetches prompts from `/api/prompts/for-conversion` with correct POST body
- [ ] Hook returns only extractor prompts (not verifiers)
- [ ] Hook exposes `isLoading`, `error`, and `retry` states
- [ ] Hook uses `credentials: 'include'` for auth
- [ ] Hook test file is placed under the existing `tests/unit/admin/exercise-conversion/` convention

---

## Step 2: Refactor `ConvertV3Button` to Include Prompt Selection

**Time**: ~20 minutes
**Requirement**: FR-1 (prompt selection interface), FR-2 (exercise generation control), FR-3 + FR-5 (verification-phase exclusion/clarification), FR-4 (UI implementation)

### Files to Touch

- `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` (MODIFIED — full rewrite, lines 1-112)

### Behavior

The `ConvertV3Button` component is refactored from a simple button into a two-state component:

**Collapsed State** (default):
- Shows "Convert V3" button (same as current)
- On click → transitions to expanded state

**Expanded State**:
- Calls `useExtractorPrompts(lessonId)` to fetch available prompts
- Shows a `<select>` dropdown with extractor prompts (first option: "Default prompt" with empty value)
- Shows "Convert" button (enabled even without selection — uses server default)
- Shows "Cancel" button (collapses back)
- Loading state: shows "Loading prompts..." text
- Error state: shows error message with "Retry" link
- Empty state: shows "No extractor prompts configured" message but still allows conversion (server will use default)

**Conversion**:
- On "Convert" click, sends POST to `/api/exercises/convert/single` with `{ lessonId, mediaId, promptId }` where `promptId` is the selected prompt ID (or omitted if "Default" selected)
- Shows existing success/error states after conversion

**Props** remain the same: `{ lessonId: string, mediaId: string }`

### Tests (FAIL before, PASS after)

**Test file**: `tests/unit/admin/exercise-conversion/ConvertV3Button.test.tsx`

1. **Test: clicking "Convert V3" expands to show prompt dropdown**
   - Mock `global.fetch` for prompts API to return 2 extractors
   - Render `<ConvertV3Button lessonId="l1" mediaId="m1" />`
   - Assert: "Convert V3" button is visible
   - Click "Convert V3"
   - Assert: A `<select>` element appears with options for the 2 extractors plus "Default prompt"
   - Assert: "Convert" and "Cancel" buttons appear

2. **Test: selecting a prompt and converting sends promptId to endpoint**
   - Mock `global.fetch` for prompts API to return `[{ id: 'prompt-123', title: 'My Extractor' }]`
   - Mock `global.fetch` for `/api/exercises/convert/single` to return `{ success: true, data: { exerciseId: 'ex1', adminUrl: '/admin/exercises/ex1' } }`
   - Render `<ConvertV3Button lessonId="l1" mediaId="m1" />`
   - Click "Convert V3" to expand
   - Wait for prompts to load
   - Select "My Extractor" in dropdown
   - Click "Convert"
   - Assert: `fetch` was called with body `{ lessonId: 'l1', mediaId: 'm1', promptId: 'prompt-123' }`

3. **Test: converting without selecting prompt omits promptId**
   - Mock `global.fetch` for prompts API to return extractors
   - Mock `global.fetch` for `/api/exercises/convert/single` to return success
   - Render and expand, leave dropdown on "Default prompt"
   - Click "Convert"
   - Assert: `fetch` was called with body `{ lessonId: 'l1', mediaId: 'm1' }` (no `promptId` key, or `promptId: undefined`)

4. **Test: shows error state when prompts fail to load and retry works**
   - Mock `global.fetch` to reject
   - Render and expand
   - Assert: error message displayed with "Retry" option
   - Mock `global.fetch` to succeed
    - Click retry
    - Assert: dropdown appears with prompts

5. **Test: verifier prompts are never selectable in V3 UI**
   - Mock prompt API response with both `extractors` and `verifiers`
   - Expand component and inspect dropdown options
   - Assert: only extractor titles + default option are rendered
   - Assert: no verifier title appears in options

### Acceptance Criteria

- [ ] Clicking "Convert V3" expands the component to show prompt selection (FR-1)
- [ ] Dropdown populates from `/api/prompts/for-conversion` extractors array (FR-1, FR-4)
- [ ] Selected prompt ID is passed to `/api/exercises/convert/single` as `promptId` (FR-2)
- [ ] No verifier dropdown is shown — v3 is extraction-only (FR-3, FR-5)
- [ ] Component code includes an explicit note that V3 uses extractor prompt only and verification exclusion is forward-looking (FR-5)
- [ ] Loading state shown while prompts fetch (FR-4)
- [ ] Error state with retry shown on fetch failure (NFR-2)
- [ ] Empty state allows conversion with default prompt (NFR-2)
- [ ] Cancel button collapses back to button state
- [ ] Success/error states after conversion work as before
- [ ] Existing props interface (`lessonId`, `mediaId`) is unchanged — no changes needed to `LessonConversionPanel`

---

## Step 3: Integration Test — ConvertV3Button Sends promptId to Endpoint

**Time**: ~15 minutes
**Requirement**: FR-2 (end-to-end prompt passing), Acceptance criteria items 5-8

### Files to Touch

- `tests/unit/admin/exercise-conversion/ConvertV3Button.integration.test.tsx` (NEW)

### Behavior

Integration-style test (still unit, but tests the full component flow including hook):
- Mounts `ConvertV3Button` with real `useExtractorPrompts` hook
- Mocks only `global.fetch` at the network boundary
- Verifies the complete flow: expand → load prompts → select → convert → correct API call

### Tests (FAIL before, PASS after)

1. **Test: full flow — expand, load prompts, select, convert with promptId**
   - Mock `global.fetch`:
     - First call (prompts): returns `{ extractors: [{ id: 'p1', title: 'Extractor 1', promptKey: 'e1', usage: 'extractor' }], verifiers: [{ id: 'v1', title: 'Verifier 1' }] }`
     - Second call (convert): returns `{ success: true, data: { exerciseId: 'ex1', adminUrl: '/admin/exercises/ex1' } }`
   - Render `<ConvertV3Button lessonId="lesson-abc" mediaId="media-xyz" />`
   - Click "Convert V3" to expand
   - Wait for dropdown to appear (prompts loaded)
   - Assert: dropdown has "Default prompt" + "Extractor 1" options (NOT "Verifier 1")
   - Select "Extractor 1"
   - Click "Convert"
   - Assert first fetch call: POST `/api/prompts/for-conversion` with `{ lessonId: 'lesson-abc' }`
   - Assert second fetch call: POST `/api/exercises/convert/single` with `{ lessonId: 'lesson-abc', mediaId: 'media-xyz', promptId: 'p1' }`
   - Assert: success message appears with link to `/admin/exercises/ex1`

2. **Test: full flow — expand, load prompts, convert with default (no selection)**
   - Same setup but don't select a prompt
   - Assert second fetch call body does NOT contain `promptId` (or it's undefined/empty string filtered out)

### Acceptance Criteria

- [ ] End-to-end flow works: expand → load → select → convert → success
- [ ] Verifier prompts from API response are NOT shown in dropdown
- [ ] Selected promptId is correctly passed to convert endpoint
- [ ] Default (no selection) omits promptId from convert request
- [ ] Success state shows exercise link

---

## File Change Summary

| File | Status | Description |
|------|--------|-------------|
| `src/ui/admin/exercise-conversion/hooks/useExtractorPrompts.ts` | NEW | Custom hook for fetching extractor prompts |
| `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` | MODIFIED | Refactored to include prompt selection UI |
| `tests/unit/admin/exercise-conversion/hooks/useExtractorPrompts.test.tsx` | NEW | Unit tests for the hook |
| `tests/unit/admin/exercise-conversion/ConvertV3Button.test.tsx` | NEW | Unit tests for refactored component |
| `tests/unit/admin/exercise-conversion/ConvertV3Button.integration.test.tsx` | NEW | Integration test for full flow |

## Files NOT Changed (Backend Already Supports This)

| File | Reason |
|------|--------|
| `src/app/api/exercises/convert/single/route.ts` | Already accepts optional `promptId` |
| `src/server/services/exercise-conversion/v3/extract-single.ts` | Already passes `promptId` to resolver |
| `src/server/services/exercise-conversion/v3/prompt-resolver.ts` | Already validates and resolves prompts |
| `src/app/api/prompts/for-conversion/route.ts` | Already returns `{ extractors, verifiers }` |
| `src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx` | Props interface unchanged, no modifications needed |

## Verification Commands

```bash
# Run unit tests
pnpm vitest run tests/unit/admin/exercise-conversion/

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```
