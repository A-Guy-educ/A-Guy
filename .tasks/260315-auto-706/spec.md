# Content Status Badging ("Soon" & "Just Added") - Specification

## Overview

Add visual status badges to Courses and Lessons to highlight new additions ("Just Added") and upcoming content ("Soon"). This increases student engagement and manages content expectations.

## Requirements

### 1. Status Types

#### 1.1 "Soon" (בקרוב) Tag
- **Purpose**: Build anticipation for upcoming content
- **Student Experience**: 
  - "Soon" badge appears on Course/Lesson card
  - Content is locked - clicking shows message "This content is being prepared and will be available soon"
- **Visuals**: Neutral/secondary color (Gray or Light Blue)

#### 1.2 "Just Added" (חדש) Tag
- **Purpose**: Draw attention to fresh material
- **Student Experience**:
  - "Just Added" or "New" badge appears on Course/Lesson card
  - Fully accessible - no access restrictions
- **Visuals**: High-energy color (Bright Green or Yellow)

### 2. Admin Configuration

#### 2.1 Fields in Course/Lesson Edit View
- **Status Selector**: Dropdown or Radio with options:
  - None (Default)
  - Soon
  - Just Added
- **Visibility Toggle**: Hide "Soon" content from students before ready to show
- **(Optional) New Until Date**: Auto-expire "Just Added" badge after set date

### 3. Design Guidelines

#### 3.1 Badge Styling
- Shape: Pill-shaped with rounded corners (`rounded-full`)
- Font: Assistant Bold, `text-xs` size
- Placement:
  - Course Grid: Top right or top left corner of course card
  - Lesson List: Next to lesson title or progress circle

#### 3.2 Animations
- "Just Added" badges: Subtle pulse animation to draw attention

## Acceptance Criteria

1. Admins can mark a lesson as "Soon" in Payload CMS admin panel
2. Students cannot access "Soon" content - clicking shows locked message
3. "Just Added" badge appears immediately on homepage/course list when enabled
4. Badges adapt to responsive design (mobile/desktop) without overlapping course title
5. "Soon" badge uses neutral color (Gray/Light Blue)
6. "Just Added" badge uses bright color (Green/Yellow)
7. Badge uses Assistant Bold font at text-xs size
8. "Just Added" badge has subtle pulse animation
9. Optional: "New Until" date field auto-removes "Just Added" badge after expiry

## Technical Implementation (Existing)

### Already Implemented ✅

1. **Backend Fields** (`src/server/payload/fields/contentStatus.ts`):
   - `contentStatus`: select field with None/Soon/Just Added options
   - `contentStatusVisible`: checkbox to hide "Soon" content from students
   - `contentStatusExpiresAt`: optional date for auto-expiry
   - Already added to both Courses and Lessons collections

2. **ContentStatusBadge Component** (`src/ui/web/shared/ContentStatusBadge/index.tsx`):
   - Gray badge for "Soon" status
   - Green badge with pulse animation for "Just Added"
   - Handles expiry date checking
   - Uses translations for badge labels

3. **CourseCard Integration** (`src/app/(frontend)/courses/_components/CourseCard/index.tsx`):
   - Displays ContentStatusBadge in top-right corner
   - Implements locked behavior for "Soon" courses
   - Shows toast message when clicking "Soon" course
   - Disables button for "Soon" courses

4. **Backend Query Filtering** (`src/server/repos/queries/`):
   - Courses query filters out invisible "Soon" content
   - Lessons query filters out invisible "Soon" content

5. **Translations** (`src/i18n/en.json`, `src/i18n/he.json`):
   - `soonBadge`: "Soon" / "בקרוב"
   - `justAddedBadge`: "New" / "חדש"
   - `contentLocked`: Lock message

### NOT Implemented ❌ (Gaps)

1. **LessonCard does NOT display ContentStatusBadge**
   - Location: `src/app/(frontend)/courses/_components/LessonCard/index.tsx`
   - Needs to add ContentStatusBadge component next to title
   - Needs to implement locked behavior for "Soon" lessons

## Gap Analysis

See `gap.md` for detailed gap analysis and required changes.
