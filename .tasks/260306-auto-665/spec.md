# Fix: Hardcoded preferredLocale 'he' in conversations API

## Overview

Fix a bug where new conversations are created with hardcoded Hebrew locale, ignoring user preferences.

## Requirements

- FR-1: Remove hardcoded `preferredLocale: 'he'` from conversation creation
- FR-2: Derive `preferredLocale` from request body locale parameter
- FR-3: Fall back to course's locale setting if not provided in request
- FR-4: Fall back to user's locale preference if course locale unavailable
- FR-5: Default to `'he'` only if no locale information is available

## Acceptance Criteria

- [ ] API accepts `preferredLocale` in request body
- [ ] If request body has locale, use it
- [ ] If no request body locale, check course locale
- [ ] If no course locale, check user's locale preference
- [ ] Fall back to `'he'` only when all above are unavailable
- [ ] Existing functionality continues to work
- [ ] TypeScript compiles without errors
