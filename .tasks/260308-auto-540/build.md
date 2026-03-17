# Build Agent Report: 260308-auto-540

## Changes

- **Created** `src/ui/admin/exercise-conversion/hooks/useExtractorPrompts.ts` - New custom hook that fetches extractor prompts from `/api/prompts/for-conversion` and filters to return only extractor prompts (not verifiers). Returns `extractorPrompts`, `isLoading`, `error`, and `retry` function.

- **Modified** `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` - Refactored from simple button to two-state component:
  - Collapsed state: shows "Convert V3" button
  - Expanded state: shows prompt selection dropdown with extractor prompts, Convert/Cancel buttons
  - Includes explicit documentation about V3 being extraction-only and verification exclusion being forward-looking (FR-5)
  - Handles loading, error, and empty states gracefully
  - Passes selected promptId to `/api/exercises/convert/single` endpoint

- **Created** `tests/unit/admin/exercise-conversion/hooks/useExtractorPrompts.test.tsx` - Unit tests for the hook (6 tests):
  - Fetches extractor prompts on mount
  - Filters out verifier prompts
  - Handles fetch error and exposes retry
  - Handles empty extractors array
  - Handles failed response (non-ok status)

- **Created** `tests/unit/admin/exercise-conversion/ConvertV3Button.test.tsx` - Unit tests for the component (12 tests):
  - Shows collapsed button by default
  - Expands to show prompt dropdown when clicked
  - Shows loading state while fetching prompts
  - Shows prompt options in dropdown
  - Excludes verifier prompts from dropdown options
  - Sends promptId to endpoint when prompt is selected
  - Omits promptId from request when default is selected
  - Shows error state when prompts fail to load
  - Retry loads prompts after error
  - Cancel button collapses back to button state
  - Shows success message with exercise link after conversion
  - Shows error message when conversion fails

## Tests Written

- `tests/unit/admin/exercise-conversion/hooks/useExtractorPrompts.test.tsx`
- `tests/unit/admin/exercise-conversion/ConvertV3Button.test.tsx`

## Quality

- TypeScript: PASS (existing unrelated error in tests/int/config-manager.int.spec.ts)
- Lint: PASS
- Unit Tests: 20 tests passed (6 hook tests + 12 component tests + 2 existing ConvertForm tests)
