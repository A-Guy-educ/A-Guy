# Implementation Plan: Lesson Type Tabs

> **Junior-Friendly Guide** - This plan is written for developers who may be new to the codebase. Each step includes explanations of *why* we're doing things, not just *what* to do.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Data Model Changes](#phase-1-data-model-changes)
4. [Phase 2: Shared Constants](#phase-2-shared-constants)
5. [Phase 3: Update StudyContent Component](#phase-3-update-studycontent-component)
6. [Phase 4: Migration Script](#phase-4-migration-script)
7. [Phase 5: Testing](#phase-5-testing)
8. [Phase 6: Final Verification](#phase-6-final-verification)
9. [Files Changed Summary](#files-changed-summary)
10. [Glossary](#glossary)

---

## Overview

### What We're Building

We're adding a `type` field to lessons so they can be categorized as Learning, Practice, or Exam. The **existing tab navigation** (Study/Practice/Test pages with NavigationBar) will filter lessons by type.

### Existing Architecture (DO NOT REBUILD)

The tabs already exist as separate pages with a shared navigation bar:

```
NavigationBar (src/components/HomePage/NavigationBar)
  ├── /study    → StudyContent (shows chapters + lessons)
  ├── /practice → StudyContent (same component, reused)
  ├── /ask      → Ask page
  └── /test     → Test page (currently "coming soon")
```

**Key Insight**: The tabs already exist! Each tab is a separate route (`/study`, `/practice`, `/test`) using the `NavigationBar` component. We just need to:
1. Add the `type` field to Lessons
2. Update `StudyContent` to filter lessons based on which page it's on

### Architecture Decisions

**⚠️ CRITICAL: What NOT to Do (from Fix List)**

- ❌ **DO NOT** rebuild tabs UI - tabs already exist via NavigationBar
- ❌ **DO NOT** install shadcn tabs - not needed
- ❌ **DO NOT** create new LessonTypeTabs component
- ❌ **DO NOT** add new i18n keys - translations already exist in `homepage.nav`
- ❌ **DO NOT** replace entire page files - minimal changes only
- ❌ **DO NOT** modify queries - filtering is a presentation concern

**✅ What TO Do**

- ✅ Add `type` field to Lessons collection
- ✅ Update `StudyContent` to accept a `lessonType` prop and filter lessons
- ✅ Use `effectiveType = lesson.type ?? 'learning'` for null fallback
- ✅ Hide chapters with no lessons after filtering
- ✅ Reuse existing empty state patterns (no new empty state copy)

### Existing i18n Keys (DO NOT ADD NEW ONES)

The tab labels already exist in `messages/en.json` and `messages/he.json`:

```json
"homepage": {
  "nav": {
    "study": "Study",      // Maps to type: 'learning'
    "practice": "Practice", // Maps to type: 'practice'
    "ask": "Ask",
    "test": "Test"          // Maps to type: 'exam'
  }
}
```

---

## Prerequisites

Before starting, ensure you can:

1. **Run the development server**: `pnpm dev`
2. **Access Payload admin**: http://localhost:3000/admin
3. **Run type generation**: `pnpm generate:types`
4. **Run tests**: `pnpm test:int` and `pnpm test:e2e`

---

## Phase 1: Data Model Changes

### Goal
Add a `type` field to the Lessons collection so each lesson can be categorized.

### Step 1.1: Update Lessons Collection

**File**: [src/collections/Lessons.ts](src/collections/Lessons.ts)

**Why**: The Lessons collection defines what fields a lesson has. We need to add a `type` field that stores whether it's a learning, practice, or exam lesson.

**What to do**:

Find the `fields` array (around line 41) and add the new `type` field after the `chapter` field:

```typescript
// Add this after the 'chapter' field (around line 51)
{
  name: 'type',
  type: 'select',
  required: true,
  defaultValue: 'learning',
  index: true, // Important for efficient DB lookups
  options: [
    {
      label: 'Learning',
      value: 'learning',
    },
    {
      label: 'Practice',
      value: 'practice',
    },
    {
      label: 'Exam',
      value: 'exam',
    },
  ],
  admin: {
    description: 'The type of lesson: Learning content, Practice exercises, or Exam',
    position: 'sidebar', // Shows in right sidebar for easy access
  },
},
```

**Also update** the `defaultColumns` in the `admin` config to include `type`:

```typescript
admin: {
  useAsTitle: 'title',
  defaultColumns: ['chapter', 'title', 'type', 'slug', 'order', 'status', 'isActive', 'updatedAt'],
},
```

### Step 1.2: Generate Updated Types

**Why**: After changing a collection, Payload needs to regenerate TypeScript types so your code knows the new field exists.

**What to do**:
```bash
pnpm generate:types
```

### Step 1.3: Verify the Change

**Why**: Always verify schema changes work before building on top of them.

**What to do**:
1. Start the dev server: `pnpm dev`
2. Go to http://localhost:3000/admin/collections/lessons
3. Create or edit a lesson
4. Confirm you see the "Type" dropdown in the sidebar
5. Confirm all three options appear (Learning, Practice, Exam)

**Expected Result**: The `type` field appears and works in the admin UI.

---

## Phase 2: Shared Constants

### Goal
Create a minimal mapping constant for route → lesson type. Keep it minimal - only add helpers if used in 2+ places.

### Step 2.1: Create Route-to-Type Mapping

**File**: `src/lib/constants/lesson-types.ts` (NEW FILE)

**Why**: We need a single source of truth for mapping routes to lesson types.

**What to do**:

```typescript
/**
 * Lesson Type Constants
 *
 * Maps routes to lesson types. Kept minimal per spec.
 * NOTE: Tab labels already exist in i18n (homepage.nav) - do NOT duplicate.
 */

export const LESSON_TYPES = ['learning', 'practice', 'exam'] as const

export type LessonType = (typeof LESSON_TYPES)[number]

export const DEFAULT_LESSON_TYPE: LessonType = 'learning'

/**
 * Get effective lesson type with fallback to 'learning' for null/undefined.
 * Per spec: missing type falls back to learning.
 */
export function getEffectiveLessonType(type: string | null | undefined): LessonType {
  if (type && LESSON_TYPES.includes(type as LessonType)) {
    return type as LessonType
  }
  return DEFAULT_LESSON_TYPE
}
```

---

## Phase 3: Update StudyContent Component

### Goal
Update the existing `StudyContent` component to filter lessons by type based on the current route. Make minimal changes.

### Step 3.1: Modify StudyContent to Accept Type Prop

**File**: [src/app/(frontend)/study/_components/StudyContent/index.tsx](src/app/(frontend)/study/_components/StudyContent/index.tsx)

**Why**: The component needs to know which lesson type to filter for. We pass it as a prop from the page.

**What to do** (minimal changes - only add what's needed):

1. Add the import at the top:
```typescript
import { getEffectiveLessonType, type LessonType, DEFAULT_LESSON_TYPE } from '@/lib/constants/lesson-types'
```

2. Add a prop to the component:
```typescript
interface StudyContentProps {
  /** The lesson type to filter for. Defaults to 'learning' */
  lessonType?: LessonType
}

export function StudyContent({ lessonType = DEFAULT_LESSON_TYPE }: StudyContentProps) {
```

3. Add filtering logic before rendering (after `setIsLoading(false)`):
```typescript
  // Filter chapters to only show those with lessons of the specified type
  const filteredChapters = chapters
    .map((chapter) => {
      // Filter lessons by type, using fallback for null/undefined
      const filteredLessons = chapter.lessons.filter(
        (lesson) => getEffectiveLessonType(lesson.type) === lessonType
      )
      return { ...chapter, lessons: filteredLessons }
    })
    .filter((chapter) => chapter.lessons.length > 0) // Hide chapters with no matching lessons
```

4. Update the render to use `filteredChapters` instead of `chapters`:
```typescript
  {filteredChapters.length > 0 ? (
    <div className="space-y-12">
      {filteredChapters.map((chapter) => {
        // ... existing rendering code
      })}
    </div>
  ) : (
    <EmptyState type="noLessons" />  // Reuse existing empty state
  )}
```

### Step 3.2: Update Study Page (minimal change)

**File**: [src/app/(frontend)/study/page.tsx](src/app/(frontend)/study/page.tsx)

**Why**: Pass the correct lesson type to StudyContent.

**What to do** (one line change):

```diff
-      <StudyContent />
+      <StudyContent lessonType="learning" />
```

### Step 3.3: Update Practice Page (minimal change)

**File**: [src/app/(frontend)/practice/page.tsx](src/app/(frontend)/practice/page.tsx)

**Why**: Pass the correct lesson type to StudyContent.

**What to do** (one line change):

```diff
-      <StudyContent />
+      <StudyContent lessonType="practice" />
```

### Step 3.4: Update Test Page

**File**: [src/app/(frontend)/test/page.tsx](src/app/(frontend)/test/page.tsx)

**Why**: Replace "coming soon" with actual content filtered by exam type.

**What to do**:

```typescript
import { NavigationBar } from '@/components/HomePage/NavigationBar'
import { StudyContent } from '../study/_components/StudyContent'

export default function TestPage() {
  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="exam" />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'מבחן - A-Guy',
    description: 'התכונן למבחנים',
  }
}
```

---

## Phase 4: Migration Script

### Goal
Ensure existing lessons have a type value.

### Step 4.1: Create Migration Script

**File**: `scripts/migrate-lesson-types.ts` (NEW FILE)

**Why**: Existing lessons don't have a `type` value. We need to set them all to `learning` (the default).

**What to do**:

```typescript
/**
 * Migration Script: Add type field to existing lessons
 *
 * Run with: pnpm tsx scripts/migrate-lesson-types.ts
 */

import { getPayload } from 'payload'
import config from '../src/payload.config'

async function migrateLessonTypes() {
  console.log('Starting lesson type migration...')

  const payload = await getPayload({ config })

  // Find all lessons without a type
  const lessonsWithoutType = await payload.find({
    collection: 'lessons',
    where: {
      or: [
        { type: { exists: false } },
        { type: { equals: null } },
      ],
    },
    limit: 0, // Get count only first
  })

  console.log(`Found ${lessonsWithoutType.totalDocs} lessons without type`)

  if (lessonsWithoutType.totalDocs === 0) {
    console.log('No lessons to migrate!')
    process.exit(0)
  }

  // Process in batches
  const batchSize = 100
  let processed = 0
  let page = 1

  while (processed < lessonsWithoutType.totalDocs) {
    const batch = await payload.find({
      collection: 'lessons',
      where: {
        or: [
          { type: { exists: false } },
          { type: { equals: null } },
        ],
      },
      limit: batchSize,
      page,
    })

    for (const lesson of batch.docs) {
      await payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: {
          type: 'learning', // Default all existing lessons to 'learning'
        },
      })
      processed++
      console.log(`Migrated lesson ${processed}/${lessonsWithoutType.totalDocs}: ${lesson.title}`)
    }

    page++
  }

  console.log('Migration complete!')
  process.exit(0)
}

migrateLessonTypes().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
```

### Step 4.2: Run Migration

**What to do**:
```bash
# Make sure database is running
pnpm db:start

# Run the migration
pnpm tsx scripts/migrate-lesson-types.ts
```

---

## Phase 5: Testing

### Goal
Verify everything works correctly.

### Step 5.1: Manual Testing Checklist

**Admin UI Testing**:
- [ ] Create a new lesson - type field appears with default "Learning"
- [ ] Edit existing lesson - can change type to Practice or Exam
- [ ] Type appears in lesson list columns

**Frontend Testing**:
- [ ] `/study` page shows only lessons with type "learning" (or null/undefined via fallback)
- [ ] `/practice` page shows only lessons with type "practice"
- [ ] `/test` page shows only lessons with type "exam"
- [ ] Chapters with no matching lessons are hidden
- [ ] Empty state shows when no chapters have matching lessons (reuses existing "noLessons" state)
- [ ] Existing lessons (without type) appear in Study tab (fallback to learning)

### Step 5.2: Write Integration Tests (Payload)

**File**: `tests/int/lesson-types.int.spec.ts` (NEW FILE)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload } from 'payload'
import config from '../../src/payload.config'

describe('Lesson Types', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let testCourseId: string
  let testChapterId: string
  const createdLessonIds: string[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Create test course and chapter
    const course = await payload.create({
      collection: 'courses',
      data: {
        courseLabel: 'TEST',
        title: 'Test Course for Lesson Types',
        status: 'published',
        isActive: true,
        categories: [],
      },
    })
    testCourseId = course.id

    const chapter = await payload.create({
      collection: 'chapters',
      data: {
        title: 'Test Chapter',
        course: course.id,
        status: 'published',
        isActive: true,
      },
    })
    testChapterId = chapter.id
  })

  afterAll(async () => {
    // Clean up in reverse order
    for (const id of createdLessonIds) {
      await payload.delete({ collection: 'lessons', id })
    }
    await payload.delete({ collection: 'chapters', id: testChapterId })
    await payload.delete({ collection: 'courses', id: testCourseId })
  })

  it('should create a lesson with explicit type', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Practice Lesson',
        chapter: testChapterId,
        type: 'practice',
        order: 1,
        status: 'published',
        isActive: true,
      },
    })
    createdLessonIds.push(lesson.id)

    expect(lesson.type).toBe('practice')
  })

  it('should default to learning type when not specified', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Default Type Lesson',
        chapter: testChapterId,
        order: 2,
        status: 'published',
        isActive: true,
      },
    })
    createdLessonIds.push(lesson.id)

    expect(lesson.type).toBe('learning')
  })

  it('should allow updating lesson type (editable after creation)', async () => {
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        title: 'Changeable Lesson',
        chapter: testChapterId,
        type: 'learning',
        order: 3,
        status: 'published',
        isActive: true,
      },
    })
    createdLessonIds.push(lesson.id)

    const updated = await payload.update({
      collection: 'lessons',
      id: lesson.id,
      data: { type: 'exam' },
    })

    expect(updated.type).toBe('exam')
  })

  it('should reject invalid lesson types', async () => {
    await expect(
      payload.create({
        collection: 'lessons',
        data: {
          title: 'Invalid Type Lesson',
          chapter: testChapterId,
          type: 'invalid' as any,
          order: 4,
        },
      })
    ).rejects.toThrow()
  })
})
```

### Step 5.3: Write Unit Tests (UI Logic)

**File**: `tests/unit/lesson-types.test.ts` (NEW FILE)

```typescript
import { describe, it, expect } from 'vitest'
import {
  getEffectiveLessonType,
  LESSON_TYPES,
  DEFAULT_LESSON_TYPE,
} from '@/lib/constants/lesson-types'

describe('Lesson Type Constants', () => {
  it('should have exactly three lesson types', () => {
    expect(LESSON_TYPES).toHaveLength(3)
    expect(LESSON_TYPES).toContain('learning')
    expect(LESSON_TYPES).toContain('practice')
    expect(LESSON_TYPES).toContain('exam')
  })

  it('should have learning as default type', () => {
    expect(DEFAULT_LESSON_TYPE).toBe('learning')
  })
})

describe('getEffectiveLessonType (fallback to learning)', () => {
  it('should return the type when valid', () => {
    expect(getEffectiveLessonType('learning')).toBe('learning')
    expect(getEffectiveLessonType('practice')).toBe('practice')
    expect(getEffectiveLessonType('exam')).toBe('exam')
  })

  it('should fallback to learning for null', () => {
    expect(getEffectiveLessonType(null)).toBe('learning')
  })

  it('should fallback to learning for undefined', () => {
    expect(getEffectiveLessonType(undefined)).toBe('learning')
  })

  it('should fallback to learning for invalid type', () => {
    expect(getEffectiveLessonType('invalid')).toBe('learning')
    expect(getEffectiveLessonType('')).toBe('learning')
  })
})

describe('Chapter visibility after filtering', () => {
  const mockChapters = [
    {
      id: '1',
      title: 'Chapter with learning',
      lessons: [
        { id: 'l1', type: 'learning' },
        { id: 'l2', type: 'practice' },
      ],
    },
    {
      id: '2',
      title: 'Chapter with only practice',
      lessons: [{ id: 'l3', type: 'practice' }],
    },
    {
      id: '3',
      title: 'Chapter with null type (should fallback)',
      lessons: [{ id: 'l4', type: null }],
    },
  ]

  it('should hide chapters with zero lessons after filtering', () => {
    // Filter for 'exam' type
    const filtered = mockChapters
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.filter(
          (lesson) => getEffectiveLessonType(lesson.type) === 'exam'
        ),
      }))
      .filter((chapter) => chapter.lessons.length > 0)

    expect(filtered).toHaveLength(0) // No chapters have exam lessons
  })

  it('should show chapters with matching lessons', () => {
    // Filter for 'learning' type
    const filtered = mockChapters
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.filter(
          (lesson) => getEffectiveLessonType(lesson.type) === 'learning'
        ),
      }))
      .filter((chapter) => chapter.lessons.length > 0)

    expect(filtered).toHaveLength(2) // Chapter 1 and Chapter 3 (null fallback)
  })

  it('should include lessons with null type in learning filter (fallback)', () => {
    // Filter for 'learning' type - should include null types
    const filtered = mockChapters
      .map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.filter(
          (lesson) => getEffectiveLessonType(lesson.type) === 'learning'
        ),
      }))
      .filter((chapter) => chapter.lessons.length > 0)

    const chapterWithNull = filtered.find((c) => c.id === '3')
    expect(chapterWithNull).toBeDefined()
    expect(chapterWithNull!.lessons).toHaveLength(1)
  })
})
```

### Step 5.4: Run Tests

```bash
# Run unit tests
pnpm test tests/unit/lesson-types.test.ts

# Run integration tests
pnpm test:int

# Run all tests
pnpm test
```

---

## Phase 6: Final Verification

### Step 6.1: Code Quality Checks

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format check
pnpm format:check

# Run all checks
pnpm ci:local
```

### Step 6.2: Browser Testing

1. Open `/study` - should show only learning lessons (and null types via fallback)
2. Open `/practice` - should show only practice lessons
3. Open `/test` - should show only exam lessons
4. Create a new lesson in admin with type "practice" - verify it only appears on `/practice`
5. Edit a lesson's type - verify it moves to the correct tab

### Step 6.3: Verify Spec Compliance

Checklist from the spec acceptance criteria:

- [ ] Lesson has a required, editable `type` field in Payload
- [ ] Tabs (existing pages) map correctly to lesson types
- [ ] Each tab shows only matching lessons
- [ ] Chapters with no matching lessons are not rendered
- [ ] When no chapters have matching lessons, existing empty state is shown
- [ ] Editing a lesson's type changes where it appears accordingly
- [ ] **No query modifications** - existing queries remain unchanged
- [ ] **Client-side filtering** - filtering happens in StudyContent component
- [ ] **Null/undefined fallback** - `effectiveType = lesson.type ?? 'learning'`
- [ ] **No new i18n keys** - reused existing `homepage.nav` labels
- [ ] **No new tabs UI** - reused existing NavigationBar

---

## Files Changed Summary

### New Files
| File | Purpose |
|------|---------|
| `src/lib/constants/lesson-types.ts` | Minimal route-to-type mapping + fallback helper |
| `scripts/migrate-lesson-types.ts` | Migration script |
| `tests/int/lesson-types.int.spec.ts` | Integration tests (Payload) |
| `tests/unit/lesson-types.test.ts` | Unit tests (UI filtering logic) |

### Modified Files
| File | Changes |
|------|---------|
| `src/collections/Lessons.ts` | Add `type` field |
| `src/app/(frontend)/study/_components/StudyContent/index.tsx` | Add `lessonType` prop, filter lessons, hide empty chapters |
| `src/app/(frontend)/study/page.tsx` | Pass `lessonType="learning"` (one line) |
| `src/app/(frontend)/practice/page.tsx` | Pass `lessonType="practice"` (one line) |
| `src/app/(frontend)/test/page.tsx` | Replace "coming soon" with `<StudyContent lessonType="exam" />` |

### Files NOT Modified (per spec)
| File | Reason |
|------|--------|
| `src/lib/queries/*.ts` | Spec requires generic queries remain unchanged |
| `messages/en.json` | i18n keys already exist in `homepage.nav` |
| `messages/he.json` | i18n keys already exist in `homepage.nav` |
| `src/components/ui/tabs.tsx` | Not needed - tabs UI already exists as NavigationBar |
| `src/components/HomePage/NavigationBar` | No changes needed - already works |
| `src/app/(frontend)/courses/_components/EmptyState` | Reuse existing `noLessons` type |

---

## Glossary

| Term | Definition |
|------|------------|
| **Collection** | A Payload CMS concept - like a database table that defines what fields an entity has |
| **Client-side filtering** | Filtering data in the browser (React component) rather than in the database query |
| **Fallback** | A default value used when the actual value is missing (null/undefined) |
| **effectiveType** | The lesson type to use after applying the fallback rule: `lesson.type ?? 'learning'` |
| **NavigationBar** | The existing tab-like navigation component that routes between /study, /practice, /test |

---

## Troubleshooting

### "Property 'type' does not exist on type 'Lesson'"
Run `pnpm generate:types` after modifying the collection.

### All lessons appear on Study tab
This is expected for existing lessons - they have null/undefined type which falls back to 'learning'. Run the migration script or manually set types.

### Empty state always shows on Practice/Test
Verify lessons exist with `type: 'practice'` or `type: 'exam'` in the database. Use the admin UI to create test data.

### Chapters still show with no lessons
Check that the filtering logic uses `getEffectiveLessonType()` and filters chapters with `lessons.length > 0`.

---

## Questions?

If you're stuck:
1. Check the existing code patterns in similar files
2. Run `pnpm doctor` to check your environment
3. Ask for help with specific error messages
4. Re-read the spec's "Guardrails" and "Avoid" sections
