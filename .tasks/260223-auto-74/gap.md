# Gap Analysis: 260223-auto-74

## Summary

- Gaps Found: 2
- Spec Revised: Yes

## Gaps Found

### Gap 1: Incorrect Test Expectation Reference

**Severity:** Medium
**Location:** spec.md lines 19, 33
**Issue:** The spec states that there's a test expecting `getAttribute('controls') === 'false'` for the VideoMedia component, but:
- No test file exists for VideoMedia component (verified by searching tests/)
- The only related test is in `tests/unit/exerciserenderer/MediaAttachments.test.tsx` which tests a **different component** (MediaAttachments)
- That test only checks `expect(video?.getAttribute('controls')).not.toBeNull()` (line 91), which just verifies the attribute is present, not specifically equal to `'false'`

**Fix Applied:** Updated spec to clarify that no existing test requires `'false'` value for VideoMedia's controls attribute. The requirement to use spread operator with type assertion may be unnecessary unless there's a specific requirement to set the string value explicitly.

### Gap 2: Non-existent TypeScript Error

**Severity:** Low
**Location:** spec.md line 17-19
**Issue:** The spec claims there's a TypeScript type error related to the `controls` attribute, but:
- Running `pnpm tsc --noEmit` shows no errors
- The current code `controls={false}` is valid React/TypeScript syntax
- The test expectation mentioned (`getAttribute('controls') === 'false'`) doesn't match the actual test behavior

**Fix Applied:** Removed the assumption that there's a TypeScript error. The spec should focus on the event listener cleanup as the primary fix, and the `controls` attribute change (if needed) should be minimal - either keep `controls={false}` or change to explicitly set the attribute if required by a future test.

## Changes Made to Spec

- **Removed FR-002 TypeScript error assumption**: The spec now acknowledges that there is no TypeScript error in the current codebase. The requirement to use type assertion (`{...({ controls: 'false' } as any)}`) is not supported by evidence.

- **Clarified test expectations**: Updated acceptance criteria to note that no specific test exists for VideoMedia's controls attribute. The test in MediaAttachments.test.tsx tests a different component entirely.

- **Retained FR-001 (Event Listener Cleanup)**: This is a valid, confirmed issue. The useEffect in VideoMedia (lines 16-24) adds a 'suspend' event listener without returning a cleanup function, causing the memory leak described in the task.

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
