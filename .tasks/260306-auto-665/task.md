# Task

## Issue Title

Bug: Hardcoded preferredLocale 'he' when creating new conversations
## Description

In `src/app/api/conversations/by-context/route.ts` line 87, new conversations are created with `preferredLocale: 'he'` (Hebrew) hardcoded. The system supports both `'en'` and `'he'` locales, but the API ignores the user's actual locale preference. English-speaking users will get Hebrew-locale AI responses.

## Current Behavior

```typescript
// line 87
preferredLocale: 'he',
```

All new conversations are forced to Hebrew locale regardless of the user's language settings.

## Expected Behavior

The `preferredLocale` should be derived from:
1. The request body (allow client to pass locale)
2. The course's locale setting
3. The user's locale preference
4. Fall back to `'he'` only if none of the above are available

## Files to Change

- `src/app/api/conversations/by-context/route.ts`

## Complexity

Easy — single file, change hardcoded value to use request parameter with fallback.

## Labels

bug, i18n
