# Build Agent Report: 260306-auto-665

## Changes

- Modified `src/app/api/conversations/by-context/route.ts` to fix the hardcoded `preferredLocale: 'he'` bug
- Added locale resolution logic with fallback chain:
  1. Uses `locale` from request body if provided (validates it's 'en' or 'he')
  2. Falls back to course's `locale` setting from database
  3. Defaults to `'he'` only if no locale information is available

## Tests Written

- No new tests were added. The fix is a small modification to an existing endpoint.
- All 3053 existing unit tests pass.

## Quality

- TypeScript: PASS
- Lint: PASS
