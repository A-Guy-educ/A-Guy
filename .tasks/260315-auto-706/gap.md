# Gap Analysis: 260315-auto-706

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Missing Type Generation Requirement

**Severity:** High
**Location:** Technical Notes section
**Issue:** The spec didn't mention the requirement to run `pnpm generate:types` after modifying Payload CMS collections. This is a critical step in the development workflow.
**Fix Applied:** Added FR-002 to Technical Notes specifying that `pnpm generate:types` must be run after schema changes and types imported from `@/payload-types`.

### Gap 2: Missing Translation Keys

**Severity:** High
**Location:** i18n files (he.json, en.json)
**Issue:** The spec didn't specify exact translation keys needed for the badge labels and locked message. The project uses both Hebrew and English translations.
**Fix Applied:** Added FR-003 specifying translation keys:
- `courses.contentStatus.soon`
- `courses.contentStatus.justAdded`
- `courses.contentLocked`

### Gap 3: Missing Access Control Implementation Details

**Severity:** High
**Location:** Access control integration
**Issue:** The spec mentioned "access control hook for Soon content locking" but didn't specify how to integrate with the existing `publishedAndActive` pattern found in the codebase.
**Fix Applied:** Added FR-004 specifying two approaches:
1. Extend existing `publishedAndActive` access control
2. Create new `publishedAndActiveWithStatus` that handles "Soon" visibility

### Gap 4: Missing UI Locked Message Display

**Severity:** Medium
**Location:** Frontend components
**Issue:** The spec mentions showing a message when students click "Soon" content but doesn't specify HOW (Toast? Modal? Inline message?).
**Fix Applied:** Added FR-005 specifying to use existing Toast/Notification pattern or create a Modal for displaying the locked message.

### Gap 5: Missing Pulse Animation Details

**Severity:** Medium
**Location:** Design Guidelines
**Issue:** The spec mentions "subtle pulse animation" but doesn't specify implementation details. Should use Tailwind's animate-pulse or custom CSS.
**Fix Applied:** Added FR-006 specifying to use Tailwind animation classes or custom CSS keyframe animation.

### Gap 6: Field Naming and Structure

**Severity:** Medium
**Location:** Collection schema
**Issue:** The spec mentioned "Status Selector" and "Visibility Toggle" but didn't define specific field names and types. Need consistent naming with existing collections.
**Fix Applied:** Added FR-001 with specific field definitions:
- `contentStatus`: select ('none' | 'soon' | 'justAdded')
- `contentStatusVisible`: checkbox (default: true)
- `contentStatusExpiresAt`: date (optional)

## Changes Made to Spec

- Added FR-001: Content Status Field - Schema (field names and types)
- Added FR-002: Type Generation (pnpm generate:types requirement)
- Added FR-003: Translation Keys (i18n keys for badge labels)
- Added FR-004: Access Control Integration (extends existing publishedAndActive)
- Added FR-005: UI Component - Locked Message Display (Toast/Modal pattern)
- Added FR-006: Pulse Animation (Tailwind or custom CSS)

## No Gaps Found

- None. After exploration, additional requirements were identified and spec has been updated.

## Validation Notes

Explored the following codebase areas to validate spec alignment:

1. **Collections**: Read Courses.ts and Lessons.ts - both have existing `status` and `isActive` fields
2. **Access Control**: Found `publishedAndActive` in `/src/server/payload/access/publishedAndActive.ts`
3. **Components**: Found CourseCard at `/src/app/(frontend)/courses/_components/CourseCard/index.tsx` and CourseLessonCard at `/src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx`
4. **Badge Component**: Found existing Badge at `/src/ui/web/components/badge.tsx` (shadcn/ui pattern)
5. **Translations**: Found i18n files at `/src/i18n/he.json` and `/src/i18n/en.json`
6. **Type Definitions**: Found `payload-types.ts` at root - types generated from Payload

The spec is now complete and aligned with existing codebase patterns.
