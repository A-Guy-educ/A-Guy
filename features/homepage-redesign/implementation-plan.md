# Homepage Implementation Plan: Hebrew AI-Tutor Interface

**Project:** A-Guy Education Platform
**Goal:** Replace existing CMS-driven homepage with custom AI-tutor themed design from home.html
**Approach:** Junior-friendly, phase-by-phase implementation

---

## Overview

This plan converts the home.html design into a Next.js + Payload CMS homepage that:
- Replaces current homepage at `/` route
- Uses hybrid auth: localStorage for anonymous users, database for logged-in users
- Manages content via Payload collections (Chapters, Lessons, Exercises)
- Creates separate routes: `/`, `/study`, `/practice`, `/ask`, `/test`
- Maintains RTL Hebrew layout with responsive design (mobile → desktop)

---

## Data Model Mapping

| Design Element | HTML Source | Maps To | Collection Fields |
|---|---|---|---|
| **Topics** | DATA_DB | **Chapters** | `title`, `chapterLabel`, `order` |
| **Exams** | EXAM_DB | **Lessons** | `title`, `description`, `order` |
| **Questions** | ASK_DB | **Exercises** | `title`, `content.blocks` |
| **Progress** | localStorage | **UserProgress** (NEW) | `completionPercentage`, `status` |

**Key Finding:** UserProgress collection does NOT exist yet and must be created.

---

## Phase 1: Data Layer & Collections

### 1.1 Create UserProgress Collection

**File:** `/src/collections/UserProgress.ts` (NEW)

**Schema:**
```typescript
export const UserProgress: CollectionConfig = {
  slug: 'user-progress',
  access: {
    create: authenticated,
    read: authenticatedOrOwner,
    update: authenticatedOrOwner,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'gradeLevel',
      type: 'text',
      index: true,
      admin: { description: 'Grade level (e.g., "8", "ח")' },
    },
    {
      name: 'progressRecords',
      type: 'array',
      fields: [
        {
          name: 'recordType',
          type: 'select',
          options: ['chapter', 'lesson', 'exercise'],
          required: true,
        },
        {
          name: 'recordId',
          type: 'text',
          required: true,
          index: true,
        },
        {
          name: 'completionPercentage',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 0,
        },
        {
          name: 'status',
          type: 'select',
          options: ['not_started', 'in_progress', 'completed'],
          defaultValue: 'not_started',
        },
        {
          name: 'score',
          type: 'number',
          min: 0,
          max: 100,
        },
        {
          name: 'lastAccessedAt',
          type: 'date',
        },
      ],
    },
  ],
  indexes: [
    { fields: { user: 1, gradeLevel: 1 } },
  ],
  timestamps: true,
}
```

**Why array of progressRecords:**
- Flexible tracking (chapter, lesson, exercise all in one collection)
- Single query fetches all user progress
- Easy to filter by recordType

**Access Control:**
- `authenticatedOrOwner`: Users read their own, admins read all
- Prevents users from viewing each other's progress

**After creating:**
1. Add to `/src/payload.config.ts` collections array
2. Run `pnpm generate:types`
3. Verify with `pnpm typecheck`

---

### 1.2 Create Query Functions

**File:** `/src/lib/queries/userProgress.ts` (NEW)

**Functions to implement:**
```typescript
import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// Get user progress by grade level
export const queryUserProgressByGrade = cache(
  async ({ userId, gradeLevel }: { userId: string; gradeLevel: string }) => {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'user-progress',
      where: {
        and: [
          { user: { equals: userId } },
          { gradeLevel: { equals: gradeLevel } },
        ],
      },
      limit: 1,
      pagination: false,
    })

    return result.docs?.[0] || null
  }
)

// Get progress for specific chapters (returns map: chapterId → percentage)
export const queryChapterProgress = cache(
  async ({ userId, chapterIds, gradeLevel }: {
    userId: string
    chapterIds: string[]
    gradeLevel: string
  }) => {
    const progressData = await queryUserProgressByGrade({ userId, gradeLevel })
    if (!progressData) return {}

    const progressMap: Record<string, number> = {}
    progressData.progressRecords?.forEach((record) => {
      if (record.recordType === 'chapter' && chapterIds.includes(record.recordId)) {
        progressMap[record.recordId] = record.completionPercentage || 0
      }
    })

    return progressMap
  }
)
```

**Why React cache():**
- Deduplicates identical requests in single render
- Follows existing pattern in `/src/lib/queries/courses.ts`
- Optimized for Server Components

---

### 1.3 Extend Chapters Queries

**File:** `/src/lib/queries/chapters.ts` (MODIFY)

**Add new function:**
```typescript
// Fetch chapters by grade level (filters by courseLabel)
export const queryChaptersByGrade = cache(
  async ({ gradeLevel }: { gradeLevel: string }) => {
    const payload = await getPayload({ config: configPromise })

    // Find course for this grade
    const courseResult = await payload.find({
      collection: 'courses',
      where: {
        and: [
          { courseLabel: { equals: gradeLevel } },
          { status: { equals: 'published' } },
          { isActive: { equals: true } },
        ],
      },
      limit: 1,
      pagination: false,
    })

    const course = courseResult.docs?.[0]
    if (!course) return []

    // Reuse existing function
    return queryChaptersByCourse({ courseId: course.id })
  }
)
```

**Why courseLabel:**
- Courses collection uses `courseLabel` field for grade ("8", "ח")
- Maintains existing published/active filtering pattern

**Verification:**
- Check actual courseLabel values in admin panel
- May need to support both Hebrew and numeric formats

---

### 1.4 localStorage Schema

**File:** `/src/lib/localStorage/userProfile.ts` (NEW)

**Purpose:** Type-safe localStorage for anonymous users with SSR safety

```typescript
export interface LocalUserProfile {
  gradeLevel: string // "8", "ח", etc.
  mood?: string
  lastVisit: string // ISO date
}

export interface LocalProgressRecord {
  recordId: string
  recordType: 'chapter' | 'lesson' | 'exercise'
  completionPercentage: number
  status: 'not_started' | 'in_progress' | 'completed'
  lastAccessedAt: string // ISO date
}

const STORAGE_KEYS = {
  USER_PROFILE: 'a-guy:user-profile',
  PROGRESS: 'a-guy:progress',
} as const

// Safe localStorage getters (SSR-aware)
export const getUserProfile = (): LocalUserProfile | null => {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export const setUserProfile = (profile: LocalUserProfile): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile))
}

export const getLocalProgress = (): LocalProgressRecord[] => {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export const updateLocalProgress = (record: LocalProgressRecord): void => {
  const current = getLocalProgress()
  const index = current.findIndex(
    (r) => r.recordId === record.recordId && r.recordType === record.recordType
  )

  if (index >= 0) {
    current[index] = record
  } else {
    current.push(record)
  }

  localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(current))
}
```

**Why prefixed keys (`a-guy:`):**
- Prevents collisions with other apps on same domain
- Clear namespace for debugging

**Why `typeof window` checks:**
- Prevents SSR errors in Next.js Server Components
- localStorage only exists in browser

---

## Phase 2: Component Library

### 2.1 ProgressCircle Component

**File:** `/src/components/shared/ProgressCircle/index.tsx` (NEW)

**Purpose:** Animated SVG circle showing 0-100% completion

```typescript
'use client'

interface ProgressCircleProps {
  percentage: number // 0-100
  size?: number // Default: 60
  strokeWidth?: number // Default: 4
  className?: string
}

export function ProgressCircle({
  percentage,
  size = 60,
  strokeWidth = 4,
  className = '',
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <svg width={size} height={size} className={className}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="hsl(var(--primary))"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      {/* Center text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        className="text-sm font-semibold fill-foreground"
      >
        {Math.round(percentage)}%
      </text>
    </svg>
  )
}
```

---

### 2.2 TypingAnimation Component

**File:** `/src/components/shared/TypingAnimation/index.tsx` (NEW)

```typescript
'use client'

import { useState, useEffect } from 'react'

interface TypingAnimationProps {
  text: string
  speed?: number // ms per character (default: 50)
  onComplete?: () => void
  className?: string
}

export function TypingAnimation({
  text,
  speed = 50,
  onComplete,
  className = '',
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (displayedText.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1))
      }, speed)
      return () => clearTimeout(timeout)
    } else {
      setIsComplete(true)
      onComplete?.()
    }
  }, [displayedText, text, speed, onComplete])

  return (
    <div
      className={`font-mono ${className}`}
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-2 h-5 bg-foreground ml-1 animate-pulse" />
      )}
    </div>
  )
}
```

---

### 2.3 NavigationBar Component

**File:** `/src/components/HomePage/NavigationBar/index.tsx` (NEW)

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from '@/providers/I18n'
import { cn } from '@/utilities/ui'

const NAV_ITEMS = [
  { key: 'study', href: '/study', label: 'Study' },
  { key: 'practice', href: '/practice', label: 'Practice' },
  { key: 'ask', href: '/ask', label: 'Ask' },
  { key: 'test', href: '/test', label: 'Test' },
] as const

export function NavigationBar() {
  const t = useTranslations('homepage.nav')
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-14">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'flex-1 text-center py-3 text-sm font-medium transition-colors',
                  'hover:text-primary hover:bg-muted/50',
                  isActive
                    ? 'text-primary bg-muted border-b-2 border-primary'
                    : 'text-muted-foreground'
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
```

**Translation Keys (add to messages/he.json and messages/en.json):**
```json
{
  "homepage": {
    "nav": {
      "study": "לימוד",
      "practice": "תרגול",
      "ask": "שאל",
      "test": "מבחן"
    }
  }
}
```

---

### 2.4 TopicCard Component

**File:** `/src/components/HomePage/TopicCard/index.tsx` (NEW)

```typescript
'use client'

import Link from 'next/link'
import type { Chapter } from '@/payload-types'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ProgressCircle } from '@/components/shared/ProgressCircle'

interface TopicCardProps {
  chapter: Chapter
  progress: number // 0-100
  courseSlug: string
}

export function TopicCard({ chapter, progress, courseSlug }: TopicCardProps) {
  if (!chapter.slug) return null

  return (
    <Link href={`/courses/${courseSlug}/chapters/${chapter.slug}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center gap-4">
          <ProgressCircle percentage={progress} size={50} />
          <div className="flex-1 min-w-0">
            {chapter.chapterLabel && (
              <div className="text-xs text-muted-foreground mb-1">
                {chapter.chapterLabel}
              </div>
            )}
            <CardTitle className="text-lg truncate">{chapter.title}</CardTitle>
            {chapter.description && (
              <CardDescription className="line-clamp-2 text-sm">
                {chapter.description}
              </CardDescription>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}
```

---

### 2.5 GreetingFlow Component

**File:** `/src/components/HomePage/GreetingFlow/index.tsx` (NEW)

```typescript
'use client'

import { useState } from 'react'
import { TypingAnimation } from '@/components/shared/TypingAnimation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setUserProfile } from '@/lib/localStorage/userProfile'
import { useTranslations } from '@/providers/I18n'

type FlowStep = 'greeting' | 'mood' | 'grade' | 'complete'

const MOODS = ['happy', 'neutral', 'sad', 'excited'] as const
const GRADES = ['7', '8', '9', '10', '11', '12'] as const

export function GreetingFlow({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations('homepage.greeting')
  const [step, setStep] = useState<FlowStep>('greeting')
  const [selectedMood, setSelectedMood] = useState<string>('')

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood)
    setStep('grade')
  }

  const handleGradeSelect = (grade: string) => {
    setUserProfile({
      gradeLevel: grade,
      mood: selectedMood,
      lastVisit: new Date().toISOString(),
    })
    setStep('complete')
    setTimeout(() => onComplete(), 1000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {step === 'greeting' && (
        <div className="max-w-2xl text-center">
          <TypingAnimation
            text={t('welcome')}
            speed={50}
            onComplete={() => setTimeout(() => setStep('mood'), 500)}
            className="text-2xl md:text-4xl mb-8"
          />
        </div>
      )}

      {step === 'mood' && (
        <div className="max-w-md w-full space-y-6">
          <h2 className="text-xl text-center">{t('moodQuestion')}</h2>
          <div className="grid grid-cols-2 gap-4">
            {MOODS.map((mood) => (
              <Button
                key={mood}
                variant="outline"
                size="lg"
                onClick={() => handleMoodSelect(mood)}
                className="h-20"
              >
                {t(`moods.${mood}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {step === 'grade' && (
        <div className="max-w-md w-full space-y-6">
          <h2 className="text-xl text-center">{t('gradeQuestion')}</h2>
          <Select onValueChange={handleGradeSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectGrade')} />
            </SelectTrigger>
            <SelectContent>
              {GRADES.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {t('gradeLabel', { grade })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <TypingAnimation
            text={t('letsStart')}
            speed={50}
            className="text-2xl"
          />
        </div>
      )}
    </div>
  )
}
```

**Translation Keys:**
```json
{
  "homepage": {
    "greeting": {
      "welcome": "שלום! אני המורה הדיגיטלי שלך 🤖",
      "moodQuestion": "איך אתה מרגיש היום?",
      "moods": {
        "happy": "😊 שמח",
        "neutral": "😐 רגוע",
        "sad": "😔 עצוב",
        "excited": "🤩 נלהב"
      },
      "gradeQuestion": "באיזו כיתה אתה לומד?",
      "selectGrade": "בחר כיתה",
      "gradeLabel": "כיתה {{grade}}",
      "letsStart": "בואו נתחיל!"
    }
  }
}
```

---

## Phase 3: Route Structure & Pages

### 3.1 Replace Current Homepage

**File:** `/src/app/(frontend)/page.tsx` (REPLACE)

**Before modifying:**
```bash
cp src/app/(frontend)/page.tsx src/app/(frontend)/page.tsx.backup
```

**New Implementation:**
```typescript
import { HomePage } from './_components/HomePage'

export default function HomepagePage() {
  return <HomePage />
}

export async function generateMetadata() {
  return {
    title: 'דף הבית - A-Guy',
    description: 'המורה הדיגיטלי שלך - לימוד, תרגול, שאלות ומבחנים',
  }
}
```

**File:** `/src/app/(frontend)/_components/HomePage/index.tsx` (NEW)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { getUserProfile } from '@/lib/localStorage/userProfile'
import { GreetingFlow } from '@/components/HomePage/GreetingFlow'
import { useRouter } from 'next/navigation'

export function HomePage() {
  const [showGreeting, setShowGreeting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile || !profile.gradeLevel) {
      setShowGreeting(true)
    } else {
      router.push('/study')
    }
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">טוען...</div>
      </div>
    )
  }

  if (showGreeting) {
    return <GreetingFlow onComplete={() => router.push('/study')} />
  }

  return null
}
```

---

### 3.2 Study Page

**File:** `/src/app/(frontend)/study/page.tsx` (NEW)

```typescript
import { NavigationBar } from '@/components/HomePage/NavigationBar'
import { StudyContent } from './_components/StudyContent'

export default function StudyPage() {
  return (
    <div>
      <NavigationBar />
      <StudyContent />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'לימוד - A-Guy',
    description: 'בחר נושא ללימוד',
  }
}
```

**File:** `/src/app/(frontend)/study/_components/StudyContent/index.tsx` (NEW)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { getUserProfile, getLocalProgress } from '@/lib/localStorage/userProfile'
import { TopicCard } from '@/components/HomePage/TopicCard'
import type { Chapter } from '@/payload-types'

export function StudyContent() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const [courseSlug, setCourseSlug] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      const response = await fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
      const data = await response.json()
      setChapters(data.chapters || [])
      setCourseSlug(data.courseSlug || '')

      const localProgress = getLocalProgress()
      const map: Record<string, number> = {}
      localProgress.forEach((record) => {
        if (record.recordType === 'chapter') {
          map[record.recordId] = record.completionPercentage
        }
      })
      setProgressMap(map)
      setIsLoading(false)
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">טוען...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">נושאי לימוד</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((chapter) => (
          <TopicCard
            key={chapter.id}
            chapter={chapter}
            progress={progressMap[chapter.id] || 0}
            courseSlug={courseSlug}
          />
        ))}
      </div>
      {chapters.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          אין נושאים זמינים לכיתה שלך
        </div>
      )}
    </div>
  )
}
```

---

### 3.3 API Route for Chapters by Grade

**File:** `/src/app/api/chapters/by-grade/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { queryChaptersByGrade } from '@/lib/queries/chapters'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const grade = searchParams.get('grade')

  if (!grade) {
    return NextResponse.json(
      { error: 'Grade parameter is required' },
      { status: 400 }
    )
  }

  try {
    const chapters = await queryChaptersByGrade({ gradeLevel: grade })
    const courseSlug = chapters[0]?.course?.slug || ''

    return NextResponse.json({
      chapters,
      courseSlug,
    })
  } catch (error) {
    console.error('Error fetching chapters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    )
  }
}
```

---

### 3.4 Practice, Ask, and Test Pages

**Similar structure to Study page - see full implementation details in longer version**

Create similar page structure for:
- `/src/app/(frontend)/practice/page.tsx`
- `/src/app/(frontend)/ask/page.tsx`
- `/src/app/(frontend)/test/page.tsx`

Each with their own `_components` subfolder and content components.

---

## Phase 4: Integration & Data Sync

### 4.1 Progress Sync Function

**File:** `/src/lib/sync/progressSync.ts` (NEW)

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getLocalProgress } from '@/lib/localStorage/userProfile'
import type { LocalProgressRecord } from '@/lib/localStorage/userProfile'

export async function syncLocalProgressToDatabase(
  userId: string,
  gradeLevel: string
) {
  const localProgress = getLocalProgress()
  if (localProgress.length === 0) return

  const payload = await getPayload({ config: configPromise })

  const existingResult = await payload.find({
    collection: 'user-progress',
    where: {
      and: [
        { user: { equals: userId } },
        { gradeLevel: { equals: gradeLevel } },
      ],
    },
    limit: 1,
  })

  const existing = existingResult.docs?.[0]

  if (existing) {
    const mergedRecords = mergeProgressRecords(
      existing.progressRecords || [],
      localProgress
    )
    await payload.update({
      collection: 'user-progress',
      id: existing.id,
      data: { progressRecords: mergedRecords },
    })
  } else {
    await payload.create({
      collection: 'user-progress',
      data: {
        user: userId,
        gradeLevel,
        progressRecords: localProgress.map((record) => ({
          recordType: record.recordType,
          recordId: record.recordId,
          completionPercentage: record.completionPercentage,
          status: record.status,
          lastAccessedAt: record.lastAccessedAt,
        })),
      },
    })
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem('a-guy:progress')
  }
}

function mergeProgressRecords(
  dbRecords: any[],
  localRecords: LocalProgressRecord[]
): any[] {
  const merged = new Map<string, any>()

  dbRecords.forEach((record) => {
    const key = `${record.recordType}:${record.recordId}`
    merged.set(key, record)
  })

  localRecords.forEach((record) => {
    const key = `${record.recordType}:${record.recordId}`
    const existing = merged.get(key)

    if (!existing || record.completionPercentage > existing.completionPercentage) {
      merged.set(key, {
        recordType: record.recordType,
        recordId: record.recordId,
        completionPercentage: record.completionPercentage,
        status: record.status,
        lastAccessedAt: record.lastAccessedAt,
      })
    }
  })

  return Array.from(merged.values())
}
```

---

## Phase 5: Styling & Polish

### 5.1 Theme Integration

**IMPORTANT:** All components use **existing theme variables** from `globals.css`. No new colors needed.

**Color Mapping (Light Theme):**
```
home.html design     →  Existing CSS variable
--primary-color      →  hsl(var(--primary))      /* #2d5af7 → 217 91% 60% */
--success-color      →  hsl(var(--success))      /* #27ae60 → 142 71% 45% */
--warning-color      →  hsl(var(--warning))      /* #f39c12 → 38 92% 50% */
--exam-color         →  hsl(var(--destructive))  /* #e74c3c → 0 84.2% 60.2% */
--ask-color          →  hsl(var(--accent))       /* #9b59b6 → 271 91% 65% */
--bg-color           →  hsl(var(--background))   /* #fcfdfe → 0 0% 100% */
--text-color         →  hsl(var(--foreground))   /* #1a1a1a → 222.2 84% 4.9% */
```

**Dark Theme:** Automatically handled by `[data-theme='dark']` in `globals.css`. No additional work needed.

---

### 5.2 Design System Constraints

**CRITICAL: Use Existing Design System Only**

✅ **ALLOWED:**
- **Tailwind CSS classes** - All utility classes (flex, grid, text-*, bg-*, etc.)
- **shadcn/ui components** - Button, Card, Select, etc. from `/src/components/ui/`
- **CSS variables** - `hsl(var(--primary))`, `hsl(var(--foreground))`, etc.
- **globals.css only** - Minimal additions to `/src/app/(frontend)/globals.css`

❌ **FORBIDDEN:**
- New CSS/SCSS files (no `styles.module.css`, no `HomePage.scss`)
- Inline styles with hardcoded colors (`style={{ color: '#2d5af7' }}`)
- Custom CSS classes outside globals.css
- Styled-components or CSS-in-JS libraries
- New design tokens or theme variables

---

### 5.3 Minimal globals.css Additions

**File:** `/src/app/(frontend)/globals.css` (MODIFY - add ONLY these keyframes)

```css
/* Homepage-specific animations - add to existing @layer utilities */
@layer utilities {
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

**That's it.** All other styling uses Tailwind classes.

---

### 5.4 Component Styling Examples

**✅ Correct - Using Tailwind + shadcn/ui:**
```tsx
// ProgressCircle - Inline SVG with theme variables
<svg className="transition-all duration-500">
  <circle stroke="hsl(var(--primary))" />
</svg>

// GreetingFlow - Tailwind utility classes only
<div className="min-h-screen flex flex-col items-center justify-center p-4">
  <div className="max-w-2xl text-center">
    <h1 className="text-2xl md:text-4xl mb-8">שלום!</h1>
  </div>
</div>

// TopicCard - shadcn/ui Card component
<Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
  <CardHeader className="flex flex-row items-center gap-4">
    <CardTitle className="text-lg truncate">{title}</CardTitle>
  </CardHeader>
</Card>
```

**❌ Wrong - Custom CSS files:**
```tsx
// Don't create HomePage.module.css
import styles from './HomePage.module.css'
<div className={styles.hero}> // ❌ Wrong

// Don't use inline styles with hardcoded colors
<div style={{ backgroundColor: '#fcfdfe' }}> // ❌ Wrong
```

---

### 5.5 Styling Checklist

Before creating any component, verify:
- [ ] Uses only Tailwind utility classes
- [ ] Uses shadcn/ui components where applicable
- [ ] Colors use `hsl(var(--*))` CSS variables
- [ ] No new `.css`, `.scss`, or `.module.css` files created
- [ ] Animations defined in globals.css `@layer utilities`
- [ ] No hardcoded hex colors anywhere

---

## Implementation Checklist

### Phase 1: Data Layer
- [ ] Create `/src/collections/UserProgress.ts`
- [ ] Create `/src/access/authenticatedOrOwner.ts`
- [ ] Add UserProgress to `payload.config.ts`
- [ ] Run `pnpm generate:types`
- [ ] Create `/src/lib/queries/userProgress.ts`
- [ ] Modify `/src/lib/queries/chapters.ts`
- [ ] Create `/src/lib/localStorage/userProfile.ts`
- [ ] Run `pnpm typecheck`

### Phase 2: Components
- [ ] Create ProgressCircle component
- [ ] Create TypingAnimation component
- [ ] Create NavigationBar component
- [ ] Create TopicCard component
- [ ] Create GreetingFlow component
- [ ] Add translations to messages files

### Phase 3: Routes
- [ ] Backup homepage
- [ ] Replace homepage with new implementation
- [ ] Create Study page and components
- [ ] Create API route for chapters by grade
- [ ] Create Practice, Ask, Test pages

### Phase 4: Integration
- [ ] Create progress sync functions
- [ ] Create progress update hook
- [ ] Create progress API route
- [ ] Integrate with login flow

### Phase 5: Styling
- [ ] Add homepage styles to globals.css
- [ ] Create loading skeleton component
- [ ] Create error message component
- [ ] Test responsive design

---

## Key Blockers to Clarify

1. **courseLabel Format** - Check if courses use "8" or "ח"
2. **Auth Integration** - How to get user ID in API routes?
3. **Login Flow** - Where to add progress sync call?

---

**Plan complete. Ready for implementation.**
