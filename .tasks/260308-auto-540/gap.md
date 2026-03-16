# Gap Analysis: 260308-auto-540

## Summary

- Gaps Found: 4
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Prompt Selection UI in ConvertV3Button Component

**Severity:** Critical
**Location:** `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx`
**Issue:** The spec requires admins to select a prompt when using v3 conversion (FR-1), but the current `ConvertV3Button` component is a simple button that calls `/api/exercises/convert/single` without any prompt selection. The endpoint accepts an optional `promptId` parameter, but the UI doesn't provide a way to select one.

**Fix Applied:** Added FR-4: Prompt Selection UI Implementation - The spec now includes detailed requirements for the UI implementation:
- Must fetch extractor prompts from `/api/prompts/for-conversion`
- Must display dropdown/selection UI with available prompts
- Must pass selected promptId to the conversion endpoint
- Must handle loading and error states

### Gap 2: Missing Endpoint Parameter Documentation for promptId

**Severity:** High
**Location:** `src/app/api/exercises/convert/single/route.ts`
**Issue:** The v3 conversion endpoint already accepts an optional `promptId` parameter, but the spec doesn't mention this existing capability. The spec implies the prompt selection is a new feature, but the backend already supports it.

**Fix Applied:** Updated FR-2 to clarify that the selected promptId is passed to the existing `/api/exercises/convert/single` endpoint, which already has prompt resolution logic in `prompt-resolver.ts`.

### Gap 3: Ambiguity About Verification Phase in v3

**Severity:** Medium
**Location:** `src/server/services/exercise-conversion/v3/`
**Issue:** FR-3 states "The selected prompt must strictly be excluded from the verification phase of the process." However:
- The v3 conversion currently has NO verification phase (unlike v1/v2 which uses separate extractor and verifier prompts)
- There's no verification code in the v3 service directory
- This creates confusion: is verification a future requirement, or a misunderstanding?

**Fix Applied:** Added FR-5: Verification Phase Clarification - The spec now includes a clarifying note that:
- Currently, v3 is extraction-only with no verification phase
- The exclusion requirement (FR-3) is a forward-looking requirement for when/if verification is added to v3
- If verification is implemented in v3, the selected prompt should be excluded (different from verifier)

### Gap 4: No Extraction-Only Prompt Filter in Existing API

**Severity:** Medium
**Location:** `src/app/api/prompts/for-conversion/route.ts`
**Issue:** The existing `/api/prompts/for-conversion` endpoint returns both `extractors` and `verifiers`. For v3 (extraction-only), we only need extractors. While the UI could filter this, it would be more efficient to add a query parameter to filter by usage type.

**Fix Applied:** Added NFR-3: API Efficiency - The spec now includes a non-functional requirement that recommends adding a `usage` filter parameter to `/api/prompts/for-conversion` for more efficient v3 prompt loading.

## Changes Made to Spec

### Added Functional Requirements:

- **FR-4: Prompt Selection UI Implementation**
  - When v3 conversion is initiated, the UI must fetch available extractor prompts from `/api/prompts/for-conversion` endpoint
  - The UI must display a selection interface (dropdown or similar) with the available prompts
  - The selected prompt's ID must be passed to the `/api/exercises/convert/single` endpoint as `promptId`
  - The UI must handle loading, error, and empty states gracefully

- **FR-5: Verification Phase Clarification**
  - Currently v3 conversion is extraction-only (no verification phase)
  - The "exclude from verification" requirement (FR-3) applies only if/when verification is added to v3
  - If verification is added, the selected extractor prompt should NOT be used as the verifier prompt

### Added Non-Functional Requirements:

- **NFR-1: Authentication**
  - The prompt selection UI must work within the existing admin authentication context
  - Prompt fetching uses existing `/api/prompts/for-conversion` which requires admin access

- **NFR-2: Error Handling**
  - If prompt fetching fails, show error message and allow retry
  - If no extractor prompts are available, display appropriate message

- **NFR-3: API Efficiency (Recommended)**
  - Consider adding a `usage` filter parameter to `/api/prompts/for-conversion` to return only extractors for v3

### Updated Acceptance Criteria:

- [x] Added acceptance criteria for FR-4: UI displays prompt selection, fetches from API, passes promptId
- [x] Added acceptance criteria for FR-5: Clarifies verification phase status

## Codebase References Found

| Component | Location | Status |
|-----------|----------|--------|
| Prompts Collection | `src/server/payload/collections/Prompts.ts` | Exists - has `usage` field with 'extractor', 'verifier', 'chat' |
| Prompts API | `src/app/api/prompts/for-conversion/route.ts` | Exists - returns extractors and verifiers |
| V3 Conversion Endpoint | `src/app/api/exercises/convert/single/route.ts` | Exists - accepts optional `promptId` |
| V3 Extract Service | `src/server/services/exercise-conversion/v3/extract-single.ts` | Exists - uses `resolveExtractorPrompt` |
| Prompt Resolver | `src/server/services/exercise-conversion/v3/prompt-resolver.ts` | Exists - validates promptId or finds default |
| ConvertV3Button | `src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx` | Exists - needs prompt selection UI |
| ConvertForm (v1/v2) | `src/ui/admin/exercise-conversion/ConvertForm/index.tsx` | Reference pattern for prompt selection UI |

## Conclusion

The spec is mostly aligned with the codebase but has gaps in:
1. UI implementation details (most critical)
2. Documentation of existing endpoint capabilities
3. Clarification of verification phase status

The revised spec addresses these gaps by adding FR-4 (UI implementation), FR-5 (verification clarification), and NFRs (error handling, auth, efficiency).
