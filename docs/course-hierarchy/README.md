# Course Hierarchy Query Patterns

**Status**: ✅ Complete - Production Ready
**Last Updated**: 2026-01-07

This document describes the 4-level course hierarchy structure and efficient query patterns for navigating and populating relationships.

---

## 📂 Hierarchy Structure

```
Course (Root)
  ↓ has many
Chapter (Level 2)
  ↓ has many
Lesson (Level 3)
  ↓ has many
Exercise (Level 4 - Leaf)
```

### Collections Overview

| Collection | Parent Field | Index | Common Filters |
|------------|--------------|-------|----------------|
| **Courses** | N/A (root) | N/A | `status`, `isActive`, `slug` |
| **Chapters** | `course` → Courses | ✅ Indexed | `course`, `status`, `isActive`, `slug` |
| **Lessons** | `chapter` → Chapters | ✅ Indexed | `chapter`, `status`, `isActive`, `slug` |
| **Exercises** | `lesson` → Lessons | ✅ Indexed | `lesson`, `order` |

---

## 🎯 Core Query Patterns

### Pattern 1: Direct Children (One Level Down)

**Use Case**: Get immediate children of a parent entity

#### Get Chapters for Course

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// ✅ CORRECT: Efficient single-level query
const payload = await getPayload({ config: configPromise })

const chapters = await payload.find({
  collection: 'chapters',
  where: {
    and: [
      { course: { equals: courseId } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
    ],
  },
  sort: 'order',
  limit: 1000,
  pagination: false,
  depth: 1, // Populate course relationship
})

// Result: chapters.docs = [Chapter, Chapter, ...]
```

#### Get Lessons for Chapter

```typescript
// ✅ CORRECT: Filter by parent chapter
const lessons = await payload.find({
  collection: 'lessons',
  where: {
    and: [
      { chapter: { equals: chapterId } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
    ],
  },
  sort: 'order',
  limit: 1000,
  pagination: false,
  depth: 1,
})
```

#### Get Exercises for Lesson

```typescript
// ✅ CORRECT: No status filter (exercises inherit lesson status)
const exercises = await payload.find({
  collection: 'exercises',
  where: {
    lesson: { equals: lessonId },
  },
  sort: 'order',
  limit: 1000,
  pagination: false,
  depth: 1,
})
```

---

### Pattern 2: Multi-Level Descendants (Bulk Query)

**Use Case**: Get all descendants across multiple levels (e.g., all lessons in a course)

#### Get All Lessons in Course (via Chapters)

```typescript
import { queryChaptersByCourse } from '@/lib/queries/chapters'

// Step 1: Get chapters for course
const chapters = await queryChaptersByCourse({ courseId })

// Step 2: Extract chapter IDs
const chapterIds = chapters.map((chapter) => chapter.id)

if (chapterIds.length === 0) {
  return [] // No chapters = no lessons
}

// Step 3: Query lessons using IN operator (CRITICAL for performance)
// ✅ CORRECT: Single query for all lessons
const lessons = await payload.find({
  collection: 'lessons',
  where: {
    and: [
      {
        chapter: {
          in: chapterIds, // Batch query (NOT equals)
        },
      },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },
    ],
  },
  sort: 'order',
  limit: 1000,
  pagination: false,
  depth: 2, // Populate lesson + chapter
})

// Result: All lessons across all chapters
```

**Why `in` operator?**
- ✅ Single database query (efficient)
- ✅ Handles multiple parent IDs
- ❌ Avoid loop + equals (N+1 problem)

#### Get All Exercises in Chapter (via Lessons)

```typescript
import { queryLessonsByChapter } from '@/lib/queries/lessons'

// Step 1: Get lessons for chapter
const lessons = await queryLessonsByChapter({ chapterId })

// Step 2: Extract lesson IDs
const lessonIds = lessons.map((lesson) => lesson.id)

if (lessonIds.length === 0) {
  return []
}

// Step 3: Batch query exercises
// ✅ CORRECT: Use IN operator for multiple lessons
const exercises = await payload.find({
  collection: 'exercises',
  where: {
    lesson: {
      in: lessonIds, // Single query for all exercises
    },
  },
  sort: 'order',
  limit: 5000, // Higher limit for leaf nodes
  pagination: false,
  depth: 2,
})

// Result: All exercises across all lessons in chapter
```

---

### Pattern 3: Deep Population (Relationship Depth)

**Use Case**: Populate relationships to access nested data

#### Depth Levels Explained

| Depth | What Gets Populated | Use Case |
|-------|---------------------|----------|
| `0` | IDs only (no population) | When you only need IDs |
| `1` | Direct parent/children | Most common (one level) |
| `2` | Parent + grandparent | Full breadcrumb trail |
| `3+` | Great-grandparents | Rarely needed |

#### Query Lesson with Full Hierarchy

```typescript
// ✅ CORRECT: depth=2 populates lesson → chapter → course
const lesson = await payload.findByID({
  collection: 'lessons',
  id: lessonId,
  depth: 2,
})

// Access nested data:
console.log(lesson.chapter.course.title) // "Course 8 Math"
console.log(lesson.chapter.title) // "Chapter 1: Algebra"
console.log(lesson.title) // "Lesson 3: Quadratic Equations"
```

#### Query Exercise with Lesson + Chapter + Course

```typescript
// ✅ CORRECT: depth=3 populates full hierarchy
const exercise = await payload.findByID({
  collection: 'exercises',
  id: exerciseId,
  depth: 3,
})

// Full breadcrumb access:
const breadcrumb = {
  course: exercise.lesson.chapter.course.title,
  chapter: exercise.lesson.chapter.title,
  lesson: exercise.lesson.title,
  exercise: exercise.title,
}
```

**Performance Note**: Higher depth = more database joins. Use minimum depth needed.

---

### Pattern 4: Status Cascade (Visibility Rules)

**Use Case**: Respect parent visibility when querying children

#### Rule: Published + Active Cascade

```
Published Course → only show Published Chapters
Published Chapter → only show Published Lessons
Published Lesson → show all Exercises (no exercise status field)
```

#### Query Published Chapter with Published Course

```typescript
// ✅ CORRECT: Filter chapter by status AND course status
const chapter = await payload.find({
  collection: 'chapters',
  where: {
    and: [
      { slug: { equals: chapterSlug } },
      { status: { equals: 'published' } },
      { isActive: { equals: true } },

      // Also filter by parent course status
      {
        'course.status': { equals: 'published' },
      },
      {
        'course.isActive': { equals: true },
      },
    ],
  },
  depth: 2,
})

// ❌ WRONG: Querying chapter without checking parent course
// Could return chapter for draft/archived course!
```

#### Student View: All Visible Content

```typescript
// ✅ CORRECT: Cascade filters through hierarchy
async function getStudentCourseView(courseSlug: string) {
  // 1. Get published course
  const course = await payload.find({
    collection: 'courses',
    where: {
      and: [
        { slug: { equals: courseSlug } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    depth: 0,
  })

  if (!course.docs[0]) return null

  // 2. Get published chapters
  const chapters = await payload.find({
    collection: 'chapters',
    where: {
      and: [
        { course: { equals: course.docs[0].id } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    sort: 'order',
  })

  // 3. Get published lessons
  const chapterIds = chapters.docs.map(c => c.id)
  const lessons = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        { chapter: { in: chapterIds } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    sort: 'order',
  })

  // 4. Get all exercises (no status filter)
  const lessonIds = lessons.docs.map(l => l.id)
  const exercises = await payload.find({
    collection: 'exercises',
    where: {
      lesson: { in: lessonIds },
    },
    sort: 'order',
  })

  return { course: course.docs[0], chapters: chapters.docs, lessons: lessons.docs, exercises: exercises.docs }
}
```

---

## ⚡ Performance Optimization

### Anti-Pattern: N+1 Query Problem

```typescript
// ❌ BAD: N+1 queries (1 chapter query + N lesson queries)
const chapters = await payload.find({ collection: 'chapters', where: { course: { equals: courseId } } })

// This loop creates N queries!
for (const chapter of chapters.docs) {
  const lessons = await payload.find({
    collection: 'lessons',
    where: { chapter: { equals: chapter.id } }, // QUERY PER CHAPTER!
  })
  chapter.lessons = lessons.docs
}

// If you have 10 chapters: 1 + 10 = 11 queries! 😱
```

### Solution: Batch Query with IN Operator

```typescript
// ✅ GOOD: 2 queries total (1 chapter + 1 lesson batch)
const chapters = await payload.find({
  collection: 'chapters',
  where: { course: { equals: courseId } },
})

const chapterIds = chapters.docs.map(c => c.id)

// Single query for ALL lessons across ALL chapters
const lessons = await payload.find({
  collection: 'lessons',
  where: {
    chapter: { in: chapterIds }, // Batch query
  },
})

// Group lessons by chapter in memory (fast)
const lessonsByChapter = lessons.docs.reduce((acc, lesson) => {
  const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter.id
  if (!acc[chapterId]) acc[chapterId] = []
  acc[chapterId].push(lesson)
  return acc
}, {})

// Attach lessons to chapters
chapters.docs.forEach(chapter => {
  chapter.lessons = lessonsByChapter[chapter.id] || []
})

// Result: 2 queries instead of 11 ✅
```

### Depth vs. Manual Population

```typescript
// Option 1: Use depth parameter (automatic population)
// ✅ PROS: Simple, automatic joins
// ❌ CONS: Can over-fetch data, less control
const lessons = await payload.find({
  collection: 'lessons',
  depth: 2, // Auto-populates chapter + course
})

// Option 2: Manual population with select
// ✅ PROS: Fine-grained control, only fetch needed fields
// ❌ CONS: More code, manual joins
const lessons = await payload.find({
  collection: 'lessons',
  depth: 0, // IDs only
  select: {
    id: true,
    title: true,
    chapter: true, // ID only
  },
})

// Then fetch chapters separately if needed
const chapterIds = [...new Set(lessons.docs.map(l => l.chapter))]
const chapters = await payload.find({
  collection: 'chapters',
  where: { id: { in: chapterIds } },
  select: { id: true, title: true },
})
```

**Recommendation**: Use `depth: 1-2` for most cases. Manual population only if you have specific performance needs.

---

## 🔧 Common Use Cases

### Use Case 1: Course Navigation Menu

```typescript
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryChaptersByCourse } from '@/lib/queries/chapters'

async function getCourseNavigation(courseSlug: string) {
  // 1. Get course
  const course = await queryCourseBySlug({ slug: courseSlug })
  if (!course) return null

  // 2. Get chapters (published + active)
  const chapters = await queryChaptersByCourse({ courseId: course.id })

  // 3. Get all lessons for all chapters (batch query)
  const chapterIds = chapters.map(c => c.id)
  const lessons = await payload.find({
    collection: 'lessons',
    where: {
      and: [
        { chapter: { in: chapterIds } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    sort: 'order',
  })

  // 4. Group lessons by chapter
  const lessonsByChapter = lessons.docs.reduce((acc, lesson) => {
    const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter.id
    if (!acc[chapterId]) acc[chapterId] = []
    acc[chapterId].push(lesson)
    return acc
  }, {})

  // 5. Build navigation structure
  return {
    course,
    chapters: chapters.map(chapter => ({
      ...chapter,
      lessons: lessonsByChapter[chapter.id] || [],
    })),
  }
}
```

### Use Case 2: Lesson Page (with Breadcrumbs)

```typescript
import { queryLessonBySlug } from '@/lib/queries/lessons'

async function getLessonPage(lessonSlug: string) {
  // ✅ depth=2 populates lesson → chapter → course
  const lesson = await queryLessonBySlug({ slug: lessonSlug })
  if (!lesson) return null

  // Access breadcrumb data:
  const breadcrumbs = [
    { title: lesson.chapter.course.title, href: `/courses/${lesson.chapter.course.slug}` },
    { title: lesson.chapter.title, href: `/courses/${lesson.chapter.course.slug}/chapters/${lesson.chapter.slug}` },
    { title: lesson.title, href: `/courses/${lesson.chapter.course.slug}/chapters/${lesson.chapter.slug}/lessons/${lesson.slug}` },
  ]

  return { lesson, breadcrumbs }
}
```

### Use Case 3: Exercise List for Lesson

```typescript
import { queryExercisesByLesson } from '@/lib/queries/exercises'

async function getLessonExercises(lessonId: string) {
  // ✅ Simple query, exercises inherit lesson visibility
  const exercises = await queryExercisesByLesson({ lessonId })

  return exercises
}
```

### Use Case 4: Search Across Hierarchy

```typescript
async function searchExercises(searchTerm: string, courseId?: string) {
  const payload = await getPayload({ config: configPromise })

  // Build query
  const where: any = {
    title: { contains: searchTerm },
  }

  // Optionally filter by course
  if (courseId) {
    // Get all lessons in course
    const chapters = await payload.find({
      collection: 'chapters',
      where: { course: { equals: courseId } },
      select: { id: true },
    })

    const chapterIds = chapters.docs.map(c => c.id)
    const lessons = await payload.find({
      collection: 'lessons',
      where: { chapter: { in: chapterIds } },
      select: { id: true },
    })

    const lessonIds = lessons.docs.map(l => l.id)
    where.lesson = { in: lessonIds }
  }

  const exercises = await payload.find({
    collection: 'exercises',
    where,
    depth: 3, // Populate full hierarchy for results
  })

  return exercises.docs
}
```

---

## 🛡️ Type Safety

### TypeScript with Population

```typescript
import type { Course, Chapter, Lesson, Exercise } from '@/payload-types'

// Unpopulated (IDs only)
type ChapterWithId = Chapter & {
  course: string // ID only
}

// Populated depth=1
type ChapterWithCourse = Chapter & {
  course: Course // Full object
}

// Populated depth=2 (recursive)
type LessonFullyPopulated = Lesson & {
  chapter: Chapter & {
    course: Course
  }
}

// Use type guards for runtime safety
function isCoursePopulated(course: string | Course): course is Course {
  return typeof course === 'object'
}

// Usage
const lesson = await payload.findByID({ collection: 'lessons', id, depth: 2 })
const chapter = lesson.chapter

if (isCoursePopulated(chapter.course)) {
  console.log(chapter.course.title) // Type-safe access
}
```

---

## 📋 Query Reference Table

| Task | Pattern | Operator | Depth |
|------|---------|----------|-------|
| Get chapters for course | `where: { course: { equals } }` | `equals` | 1 |
| Get lessons for chapter | `where: { chapter: { equals } }` | `equals` | 1 |
| Get exercises for lesson | `where: { lesson: { equals } }` | `equals` | 1 |
| Get all lessons in course | Get chapters → `where: { chapter: { in } }` | `in` | 2 |
| Get all exercises in chapter | Get lessons → `where: { lesson: { in } }` | `in` | 2 |
| Get exercise with breadcrumbs | `findByID` with `depth: 3` | N/A | 3 |
| Published content only | `where: { and: [status, isActive] }` | `equals` | Any |

---

## 💡 Best Practices

### DO ✅
- Use `in` operator for batch queries (avoid N+1)
- Index parent relationship fields (`course`, `chapter`, `lesson`)
- Filter by `status` and `isActive` for user-facing queries
- Use `depth: 1-2` for most queries (balance performance vs. convenience)
- Cache query results with React `cache()` for Server Components
- Sort by `order` field for consistent display
- Set reasonable `limit` (1000 for parents, 5000 for leaves)
- Use `pagination: false` for full result sets

### DON'T ❌
- Don't query in loops (use `in` operator instead)
- Don't use `depth > 3` unless absolutely necessary
- Don't forget `status` and `isActive` filters for public views
- Don't expose draft content to students
- Don't hard-code IDs (use slugs for routing)
- Don't fetch entire collections without `where` clause
- Don't use `depth: 0` if you need populated data

---

## 🔗 Related Documentation

- **[Collections](../../src/server/payload/collections/README.md)** - Collection configurations
- **[Access Control](../access-control/README.md)** - Permission patterns
- **[AGENTS.md](../../AGENTS.md)** - Payload CMS query patterns

---

## 🚀 Future Enhancements

### Planned Features
- [ ] Aggregate queries (count exercises per lesson)
- [ ] Full-text search across hierarchy
- [ ] Bulk update operations
- [ ] Caching layer (Redis)
- [ ] GraphQL API for hierarchy traversal

---

**Last Updated**: 2026-01-07
**Status**: ✅ Production Ready
