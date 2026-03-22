# Feature: Prompt Selection for PDF-to-Exercise Conversion (Version 3)

## Overview

When an admin initiates a PDF-to-exercise conversion using the "v3" method, they must be presented with an option to select a prompt from a predefined list. The selected prompt will control the exercise generation phase and be excluded from the verification phase.

## Background

The v3 conversion system consists of:
- **Backend endpoint**: `/api/exercises/convert/single` - already accepts optional `promptId` parameter
- **Prompt resolver**: `prompt-resolver.ts` - validates prompt or finds default extractor
- **Prompts API**: `/api/prompts/for-conversion` - returns available extractor and verifier prompts
- **UI Component**: `ConvertV3Button` - currently a simple button without prompt selection

## Requirements

### FR-1: Prompt Selection Interface
- When an admin initiates a PDF-to-exercise conversion using the "v3" method, they are presented with an option to select a prompt.
- The selection interface must populate its options from the system's predefined list of saved prompts.

### FR-2: Exercise Generation Control
- The prompt selected by the admin must exclusively dictate the behavior of the exercise generation phase.
- The selected prompt ID is passed to the `/api/exercises/convert/single` endpoint as the `promptId` parameter.
- The endpoint's existing `resolveExtractorPrompt` function validates and applies the selected prompt.

### FR-3: Verification Phase Exclusion
- The selected prompt must strictly be excluded from the verification phase of the process.
- **Note**: Currently v3 is extraction-only with no verification phase. This requirement applies if/when verification is added to v3.

### FR-4: Prompt Selection UI Implementation
- The UI component (`ConvertV3Button` or wrapper) must fetch available extractor prompts from `/api/prompts/for-conversion` using the lessonId.
- The UI must display a selection interface (dropdown, modal, or inline selection) with available prompts.
- The selected prompt's ID must be passed to `/api/exercises/convert/single` as `promptId`.
- The UI must handle loading states while fetching prompts.
- The UI must handle error states if prompt fetching fails.
- The UI must handle empty state if no extractor prompts are available.

### FR-5: Verification Phase Clarification
- Currently, v3 conversion is extraction-only (no verification phase exists).
- The exclusion requirement in FR-3 is a forward-looking requirement for when/if verification is added to v3.
- If verification is implemented in v3, the selected extractor prompt should NOT be used as the verifier prompt (use a different verifier or default).

## Non-Functional Requirements

### NFR-1: Authentication
- The prompt selection UI must work within the existing admin authentication context.
- Prompt fetching uses existing `/api/prompts/for-conversion` which requires admin access.

### NFR-2: Error Handling
- If prompt fetching fails, show error message and allow retry.
- If no extractor prompts are available, display appropriate message (e.g., "No extractor prompts configured").

### NFR-3: API Efficiency (Recommended)
- Consider adding a `usage` filter parameter to `/api/prompts/for-conversion` to return only extractors for v3.
- Current workaround: UI filters the response to show only `extractors` array.

## Acceptance Criteria

- [ ] When an admin initiates a PDF-to-exercise conversion using the "v3" method, they are presented with an option to select a prompt.
- [ ] The selection interface populates its options from the system's predefined list of saved prompts.
- [ ] The prompt selected exclusively dictates the behavior of the exercise generation phase.
- [ ] The selected prompt is strictly excluded from the verification phase of the process.
- [ ] The UI fetches available extractor prompts from `/api/prompts/for-conversion` endpoint.
- [ ] The UI displays a selection interface with the available prompts.
- [ ] The selected prompt ID is passed to the `/api/exercises/convert/single` endpoint.
- [ ] The UI handles loading, error, and empty states gracefully.
- [ ] The verification phase exclusion is documented as a forward-looking requirement for v3.

## Technical Implementation Notes

1. **Existing API**: The endpoint `/api/prompts/for-conversion` returns `{ extractors: [...], verifiers: [...] }`. Use the `extractors` array for v3.

2. **Endpoint Integration**: The v3 conversion endpoint already accepts `promptId`:
   ```typescript
   // Request schema
   const extractRequestSchema = z.object({
     lessonId: z.string().min(1),
     mediaId: z.string().min(1),
     promptId: z.string().optional(), // Already exists
   })
   ```

3. **UI Pattern Reference**: See `ConvertForm` component (`src/ui/admin/exercise-conversion/ConvertForm/index.tsx`) for the existing prompt selection pattern used in v1/v2.

4. **Prompt Validation**: The backend's `resolveExtractorPrompt` function validates:
   - Prompt exists
   - Prompt has `usage: 'extractor'`
   - Prompt has `status: 'published'`
   - Prompt belongs to correct tenant
