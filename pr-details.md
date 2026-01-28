## Summary

This PR adds a complete account course selection flow with internationalization (i18n) support, including RTL for Hebrew.

## Changes

### New Components

1. **SelectedCourseCard** (`src/app/(frontend)/account/_components/SelectedCourseCard.tsx`)
   - Displays selected course in account page
   - Shows course details with proper styling

2. **RequireCourseSelection** (`src/ui/web/guards/RequireCourseSelection.tsx`)
   - Route guard component for course selection enforcement
   - Redirects users to course selection if no course is selected

3. **AccountPageContent** (`src/app/(frontend)/account/AccountPageContent.tsx`)
   - Main account page with course selection UI
   - Integrates SelectedCourseCard component

4. **Ask Page** (`src/app/(frontend)/ask/page.tsx`)
   - New page for user inquiries

### Updated Files

1. **userProfile State** (`src/client/state/localStorage/userProfile.ts`)
   - Enhanced localStorage persistence for user preferences
   - Course selection state management

2. **i18n Translations**
   - English (`src/i18n/en.json`): Added account and course-related translations
   - Hebrew (`src/i18n/he.json`): Added RTL-compatible translations

3. **Documentation**
   - AGENTS.md: Updated Payload CMS development guidelines
   - Added plans directory with feature planning documents

## Features

- Course selection flow in account page
- RTL support for Hebrew language
- Local storage persistence for user preferences
- Route guards for protected course selection
- Component-based architecture for maintainability

## Files Changed

- `plans/payload-first-url-plan.md` (new)
- `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` (new)
- `src/app/(frontend)/account/AccountPageContent.tsx` (modified)
- `src/app/(frontend)/ask/page.tsx` (new)
- `src/client/state/localStorage/userProfile.ts` (modified)
- `src/i18n/en.json` (modified)
- `src/i18n/he.json` (modified)
- `src/ui/web/guards/RequireCourseSelection.tsx` (new)
- `AGENTS.md` (modified)
- `.roo/rules/index.md` (modified)

## Testing

- [ ] Verify course selection flow works correctly
- [ ] Test RTL layout for Hebrew
- [ ] Verify local storage persistence
- [ ] Test route guard behavior

## Checklist

- [x] Code follows project conventions
- [x] Self-reviewed changes
- [ ] Documentation updated
- [ ] Tests added/updated

---

**PR URL**: https://github.com/A-Guy-educ/A-Guy/pull/new/feat/account-course-selection-i18n
**Base Branch**: dev
**Compare Branch**: feat/account-course-selection-i18n
