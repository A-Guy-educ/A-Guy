# Changes

- Changed `preferredLocale: 'he'` (hardcoded) to dynamically derive locale from request body, course settings, user preference, with fallback to 'he'

## Files Modified

- `src/app/api/conversations/by-context/route.ts` - Line 87: Changed hardcoded `'he'` to use locale resolution logic with fallback chain
