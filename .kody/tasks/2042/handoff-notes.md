# Handoff Notes for Issue #2042

## What was done

**Bug**: When PDFEmbed received an empty URL (empty string), it would render an iframe with `src=""` showing about:blank (blank white page) for 3 seconds before showing the fallback with a broken download button.

**Fix**: Modified `PDFEmbed` component (`src/ui/web/courses/PDFViewer/PDFEmbed.tsx`) to:
1. Detect empty/invalid URL immediately using `isEmptyUrl` check
2. Show fallback immediately (not after 3 seconds) when URL is empty
3. Display "No PDF URL provided." message without a broken download button

## Files changed

- `src/ui/web/courses/PDFViewer/PDFEmbed.tsx`: Added `isEmptyUrl` check, immediate fallback for empty URL, conditional message
- `tests/e2e/pdf-embed-xframe.e2e.spec.ts`: Added test for empty URL case

## Verification

- TypeScript typecheck: PASSED
- Lint: PASSED (no new warnings)
- Format check: PASSED
- E2E tests: CANNOT RUN - Chromium cannot connect to localhost:3000 in this environment (infrastructure issue, not code issue)

## Key change

Added to `useEffect`:
```tsx
if (isEmptyUrl) {
  fallbackShownRef.current = true
  setShowFallback(true)
  return
}
```

Added to fallback render:
```tsx
{isEmptyUrl ? (
  <p className="text-muted-foreground mb-3">No PDF URL provided.</p>
) : (
  <>...</>
)}
```
