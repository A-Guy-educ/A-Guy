# Gap Analysis: 260223-auto-74

## Summary

- Gaps Found: 2
- Spec Revised: Yes

## Gaps Found

### Gap 1: Incorrect Test Expectation Reference

**Severity:** Medium
**Location:** spec.md lines 19, 33 (original)
**Issue:** The spec stated that there's a test expecting `getAttribute('controls') === 'false'` for the VideoMedia component, but:
- No test file exists for VideoMedia component (verified by searching tests/)
- The only related test is in `tests/unit/exerciserenderer/MediaAttachments.test.tsx` which tests a **different component** (MediaAttachments)
- That test only checks `expect(video?.getAttribute('controls')).not.toBeNull()` (line 91), which just verifies the attribute is present, not specifically equal to `'false'`

**Fix Applied:** Updated spec to:
- Changed FR-002 from "MUST" to "VERIFY" priority
- Clarified that no specific test exists for VideoMedia's controls attribute
- Updated acceptance criteria to reflect that `controls={false}` is valid and should be retained unless a specific test requirement exists

### Gap 2: Non-existent TypeScript Error

**Severity:** Low
**Location:** spec.md line 17-19 (original)
**Issue:** The spec claimed there's a TypeScript type error related to the `controls` attribute, but:
- Running `pnpm tsc --noEmit` shows no errors
- The current code `controls={false}` is valid React/TypeScript syntax

**Fix Applied:** Updated FR-002 to be a "verify" requirement rather than a "must fix" requirement. The spec now acknowledges that:
- No TypeScript errors exist in the current codebase
- The controls attribute fix may not be needed

## Changes Made to Spec

- **Changed FR-002 priority from MUST to VERIFY**: The requirement to fix TypeScript errors related to `controls` attribute was changed to a verification step, since no actual TypeScript error exists.

- **Updated acceptance criteria**: Removed the incorrect test expectation reference. Now states to verify and retain `controls={false}` unless a specific test requirement exists.

- **Added Open Question**: Added a question about whether there's a specific test requirement for VideoMedia's controls attribute.

- **Updated Guardrails**: Removed reference to "specific controls attribute type error" since it doesn't exist.

## Verified Issues

The following was confirmed through code inspection:

1. **Memory leak confirmed**: In `src/ui/web/media/VideoMedia/index.tsx` lines 16-24, the useEffect adds an event listener but does not return a cleanup function:
   ```tsx
   useEffect(() => {
     const { current: video } = videoRef
     if (video) {
       video.addEventListener('suspend', () => {
         // handler
       })
     }
   }, [])
   // Missing: return () => video.removeEventListener('suspend', handler)
   ```

2. **No TypeScript errors**: Verified by running `pnpm tsc --noEmit` - no errors found.

3. **No VideoMedia-specific tests**: Searched for VideoMedia tests - none exist.
