# Spec: 260316-auto-877

## Overview

Fix the redirect destination after completing an interactive lesson. When a student finishes an interactive lesson (via the ExercisesPager) and clicks "Finish", they should be redirected to the lesson page (showing the current/interactive view), not to the chapter page (which is the "old" display behavior).

## Requirements

### FR-001: Fix Lesson Completion Redirect Destination

**Priority**: MUST
**Description**: When a student completes all exercises in an interactive lesson and clicks "Finish" on the outro screen, they should be redirected to the current lesson page (`/courses/{courseSlug}/chapters/{chapterSlug}/lessons/{lessonSlug}`), not to the chapter page (`/courses/{courseSlug}/chapters/{chapterSlug}`).

**Root Cause**: The `backUrl` variable in the LessonPage (`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` line 86) is set to `/courses/${courseSlug}/chapters/${chapterSlug}` (chapter page), but should be `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lessonSlug}` (lesson page).

**Location**: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`

### FR-002: Ensure Consistent Navigation Across All Lesson Flows

**Priority**: MUST
**Description**: The navigation behavior should be consistent across all lesson completion flows:
- ExercisePage (individual exercise) → backUrl = lesson page ✅ (correct)
- CompletePage (/complete route) → backUrl = lesson page ✅ (correct)
- ExercisesPager (interactive lesson flow) → backUrl = chapter page ❌ (incorrect - should be lesson page)

## Acceptance Criteria

- [ ] When a student completes an interactive lesson via ExercisesPager and clicks "Finish", they are redirected to the lesson page (`/courses/{courseSlug}/chapters/{chapterSlug}/lessons/{lessonSlug}`)
- [ ] The redirect goes to the lesson page, not the chapter page
- [ ] This behavior matches the ExercisePage and CompletePage flows which already use the lesson page as backUrl
- [ ] The fix applies only to the LessonPage's backUrl variable

## Guardrails

- Do not modify the ExercisePage (`exercises/[exerciseSlug]/page.tsx`) - it already has the correct backUrl
- Do not modify the CompletePage (`complete/page.tsx`) - it already has the correct backUrl
- Only modify the LessonPage (`page.tsx`) backUrl

## Out of Scope

- Does not address any other navigation issues
- Does not modify the PDF/document view flow
- Does not change the chapter page behavior
