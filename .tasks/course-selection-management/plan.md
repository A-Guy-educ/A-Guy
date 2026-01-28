# Course Selection Management - Implementation Plan

## Overview

Add course selection display to user account page with ability to remove selection, and enforce course selection on protected routes (/study, /practice, /ask, /test).

---

## 1. Clean Up Unused localStorage Progress Utilities

**File:** `src/client/state/localStorage/userProfile.ts`

Remove unused progress-related code:

- `LocalProgressRecord` interface
- `getLocalProgress()` function
- `updateLocalProgress()` function
- `clearLocalProgress()` function
- `STORAGE_KEYS.PROGRESS` constant

These are unused scaffolding - no code in the codebase calls them.

---

## 2. Add `clearUserProfile` Utility

**File:** `src/client/state/localStorage/userProfile.ts`

Add a new function to clear the user profile (remove course selection):

```typescript
export const clearUserProfile = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
  } catch (error) {
    console.error('Failed to clear user profile from localStorage:', error)
  }
}
```

---

## 3. Create `SelectedCourseCard` Component

**File:** `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` (new)

A client component that:

1. Reads `gradeLevel` from localStorage on mount
2. Fetches course via **Payload REST API** (no custom endpoint):
   - Build URL using `NEXT_PUBLIC_SERVER_URL` as base
   - Use `URLSearchParams` to safely encode query:
     - `where[courseLabel][equals]={gradeLevel}`
     - `where[status][equals]=published`
     - `where[isActive][equals]=true`
     - `limit=1`
     - `depth=1`
3. Handles 4 states:
   - **Loading**: Show spinner/skeleton UI
   - **Error**: Show fetch error message with retry option
   - **No course selected**: No gradeLevel in localStorage → show "No course selected" with link to home
   - **Course not found**: gradeLevel exists but no matching course → show "Course not found"
   - **Valid course found**: display course card
4. Shows "Remove Selection" button that:
   - Calls `clearUserProfile()`
   - Uses `router.replace('/')` for navigation
   - Optionally call `router.refresh()` after redirect

**UI Structure:**

```
┌─────────────────────────────────────────┐
│ Selected Course                         │
├─────────────────────────────────────────┤
│ [Spinner/Loading State]                 │
│                                         │
│ OR (valid course):                      │
│ [Badge: courseLabel]                    │
│ Course Title                            │
│ Course description (if available)       │
│                                         │
│ [Remove Selection Button]               │
│                                         │
│ OR (error/not found):                   │
│ Error/Not Found message + retry button  │
└─────────────────────────────────────────┘
```

---

## 4. Update Account Page

**File:** `src/app/(frontend)/account/AccountPageContent.tsx`

Add the `SelectedCourseCard` component below the existing account info card:

```tsx
<div className="mx-auto max-w-md space-y-6">
  <Card>{/* Existing account info */}</Card>
  <SelectedCourseCard />
</div>
```

---

## 5. Create `RequireCourseSelection` Guard Component

**File:** `src/ui/web/guards/RequireCourseSelection.tsx` (new)

A client component that wraps protected content:

1. Checks localStorage for `gradeLevel` on mount
2. If missing, uses `router.replace('/')` to redirect
3. If present, renders children

**Note:** Current enforcement is **client-side UX gating**, not server-side security.

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserProfile } from '@/client/state/localStorage/userProfile'

export function RequireCourseSelection({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [hasSelection, setHasSelection] = useState<boolean | null>(null)

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile?.gradeLevel) {
      router.replace('/')
      return
    }
    setHasSelection(true)
  }, [router])

  if (hasSelection === null) {
    return <Spinner /> // or loading skeleton
  }

  return <>{children}</>
}
```

---

## 6. Update Protected Routes

Apply the guard to each protected route:

### `/study` - Already has redirect logic in `StudyContent`

**File:** `src/app/(frontend)/study/page.tsx`

- No change needed - `StudyContent` already redirects if no gradeLevel

### `/practice` - Already has redirect logic in `StudyContent`

**File:** `src/app/(frontend)/practice/page.tsx`

- No change needed - `StudyContent` already redirects if no gradeLevel

### `/test` - Already has redirect logic in `StudyContent`

**File:** `src/app/(frontend)/test/page.tsx`

- No change needed - `StudyContent` already redirects if no gradeLevel

### `/ask` - Needs guard (currently a placeholder)

**File:** `src/app/(frontend)/ask/page.tsx`

Wrap content with `RequireCourseSelection`:

```tsx
import { RequireCourseSelection } from '@/ui/web/guards/RequireCourseSelection'

export default function AskPage() {
  return (
    <RequireCourseSelection>
      <div>
        <NavigationBar />
        {/* existing content */}
      </div>
    </RequireCourseSelection>
  )
}
```

---

## 7. Add Translation Strings

**Files:** `src/i18n/en.json` and `src/i18n/he.json`

Add new keys under `auth.account`:

```json
"auth": {
  "account": {
    "title": "Account",
    "name": "Name",
    "email": "Email",
    "missing": "Not provided",
    "selectedCourse": "Selected Course",
    "noCourseSelected": "No course selected",
    "selectCourse": "Select a Course",
    "removeCourseSelection": "Remove Selection",
    "loadingCourse": "Loading..."
  }
}
```

Hebrew translations:

```json
"auth": {
  "account": {
    "title": "חשבון",
    "name": "שם",
    "email": "אימייל",
    "missing": "לא סופק",
    "selectedCourse": "קורס נבחר",
    "noCourseSelected": "לא נבחר קורס",
    "selectCourse": "בחר קורס",
    "removeCourseSelection": "הסר בחירה",
    "loadingCourse": "טוען..."
  }
}
```

---

## Files to Create

| File                                                            | Purpose                        |
| --------------------------------------------------------------- | ------------------------------ |
| `src/app/(frontend)/account/_components/SelectedCourseCard.tsx` | Course card with remove button |
| `src/ui/web/guards/RequireCourseSelection.tsx`                  | Client-side route guard        |

## Files to Modify

| File                                                | Change                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `src/client/state/localStorage/userProfile.ts`      | Remove unused progress functions, add `clearUserProfile()` |
| `src/app/(frontend)/account/AccountPageContent.tsx` | Add SelectedCourseCard                                     |
| `src/app/(frontend)/ask/page.tsx`                   | Wrap with RequireCourseSelection                           |
| `src/i18n/en.json`                                  | Add translation strings                                    |
| `src/i18n/he.json`                                  | Add translation strings                                    |

---

## Verification

1. **Account page shows course card:**
   - Navigate to `/account` with a selected course
   - Verify course title and label are displayed
   - Verify "Remove Selection" button is visible

2. **Remove selection works:**
   - Click "Remove Selection"
   - Verify redirect to `/`
   - Verify localStorage is cleared

3. **Protected routes redirect when no course:**
   - Clear localStorage
   - Navigate directly to `/study`, `/practice`, `/ask`, `/test`
   - Verify all redirect to `/`

4. **Account page with no course:**
   - Clear localStorage
   - Navigate to `/account`
   - Verify "No course selected" message with link to select course

5. **Type check passes:**
   - Run `pnpm typecheck` - no errors
   - Run `pnpm lint` - no errors
