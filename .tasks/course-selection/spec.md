# Course Selection on Account Page

## Overview

Allow users to view their selected course on the account page and cancel/clear the selection, enabling them to select a new course from the home page.

## Background

Extracted from commit `2e0dfea` (branch `feat/display-selected-course-on-account-page`) - a feature that allows users to see their selected course on the account page with the ability to clear the selection.

## Files to Modify

### 1. `src/client/state/localStorage/userProfile.ts`

Add `clearUserProfile()` function:

```typescript
/**
 * Clear user profile from localStorage (SSR-safe)
 */
export const clearUserProfile = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE)
  } catch (error) {
    console.error('Failed to clear user profile from localStorage:', error)
  }
}
```

### 2. `src/app/(frontend)/account/AccountPageContent.tsx`

Update to display selected course with cancel option:

```typescript
'use client'

import type { User } from '@/payload-types'
import { Badge } from '@/ui/web/components/badge'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { clearUserProfile, getUserProfile } from '@/client/state/localStorage/userProfile'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ArrowRight, BookOpen, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export function AccountPageContent({ user }: { user: User }) {
  const t = useTranslations('auth.account')
  const [selectedCourse, setSelectedCourse] = useState<{
    courseLabel?: string
    title?: string
    description?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSelectedCourse = async () => {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(
          `/api/courses?where[courseLabel][equals]=${encodeURIComponent(profile.gradeLevel)}&where[status][equals]=published&where[isActive][equals]=true&limit=1`,
        )
        if (response.ok) {
          const data = await response.json()
          if (data.docs?.length > 0) {
            setSelectedCourse(data.docs[0])
          }
        }
      } catch (error) {
        console.error('Failed to fetch selected course:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSelectedCourse()
  }, [])

  const handleClearSelection = () => {
    clearUserProfile()
    setSelectedCourse(null)
  }

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('name')}</p>
              <p className="text-base font-medium">{user.name || t('missing')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('email')}</p>
              <p className="text-base font-medium">{user.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Selected Course Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t('selectedCourse')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground text-sm">Loading...</div>
            ) : selectedCourse ? (
              <div className="relative">
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-8 w-8 rounded-full hover:bg-destructive/10"
                  onClick={handleClearSelection}
                  aria-label={t('clearSelection')}
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Course info */}
                <div className="space-y-3 pr-8">
                  {selectedCourse.courseLabel && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedCourse.courseLabel}
                    </Badge>
                  )}
                  <h3 className="font-semibold text-lg">{selectedCourse.title}</h3>
                  {selectedCourse.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {selectedCourse.description}
                    </p>
                  )}
                </div>

                {/* Continue Learning button */}
                <Button asChild className="w-full mt-4">
                  <Link href="/study" className="flex items-center justify-center gap-2">
                    {t('continueLearning')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-4">{t('noCourseSelected')}</p>
                <Button asChild variant="outline">
                  <Link href="/">{t('selectCourse')}</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### 3. `src/i18n/en.json`

Add translation keys:

```json
{
  "auth": {
    "account": {
      "title": "Account",
      "name": "Name",
      "email": "Email",
      "missing": "Not provided",
      "selectedCourse": "Selected Course",
      "noCourseSelected": "No course selected",
      "continueLearning": "Continue Learning",
      "clearSelection": "Clear selection",
      "selectCourse": "Select a Course"
    }
  }
}
```

### 4. `src/i18n/he.json`

Add translation keys:

```json
{
  "auth": {
    "account": {
      "title": "חשבון",
      "name": "שם",
      "email": "אימייל",
      "missing": "לא סופק",
      "selectedCourse": "קורס נבחר",
      "noCourseSelected": "לא נבחר קורס",
      "continueLearning": "המשך ללמוד",
      "clearSelection": "נקה בחירה",
      "selectCourse": "בחר קורס"
    }
  }
}
```

## Implementation Notes

1. The feature reads the `gradeLevel` from localStorage user profile
2. It fetches the corresponding course via `/api/courses` API using `courseLabel` filter
3. User can clear the selection by clicking the X button, which:
   - Calls `clearUserProfile()` to remove the profile from localStorage
   - Updates local state to remove the displayed course
4. After clearing, the user sees a "Select a Course" button linking to the home page
5. All UI is SSR-safe with proper `typeof window` checks

## Original Commit

- Commit: `2e0dfea1931da1b4927cdb973d01496e33c8df99`
- Date: Wed Jan 21 18:57:04 2026
- Branch: `feat/display-selected-course-on-account-page`
