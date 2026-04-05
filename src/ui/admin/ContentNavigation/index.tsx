'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParentRecord {
  id: string
  title?: string
  adminTitle?: string
  courseLabel?: string
}

interface HierarchyData {
  lesson?: ParentRecord | null
  chapter?: ParentRecord | null
  course?: ParentRecord | null
}

type CollectionContext = 'exercises' | 'lessons'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Resolve a relationship field value to an ID string. */
function resolveId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  return null
}

/** Display name for a record, with fallback. */
function displayName(record: ParentRecord | null | undefined): string {
  if (!record) return 'Not assigned'
  return record.adminTitle || record.title || record.courseLabel || record.id
}

/** Build admin edit URL for a collection record. */
function adminUrl(collection: string, id: string): string {
  return `/admin/collections/${collection}/${id}`
}

/* ------------------------------------------------------------------ */
/*  Fetch helpers                                                      */
/* ------------------------------------------------------------------ */

async function fetchRecord(collection: string, id: string): Promise<ParentRecord | null> {
  try {
    const res = await fetch(
      `/api/${collection}/${id}?depth=0&select[title]=true&select[adminTitle]=true&select[courseLabel]=true`,
      { credentials: 'include' },
    )
    if (!res.ok) return null
    const data = await res.json()
    return {
      id: data.id,
      title: data.title,
      adminTitle: data.adminTitle,
      courseLabel: data.courseLabel,
    }
  } catch {
    return null
  }
}

async function fetchRelationshipId(
  collection: string,
  id: string,
  field: string,
): Promise<string | null> {
  try {
    const res = await fetch(`/api/${collection}/${id}?depth=0&select[${field}]=true`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = await res.json()
    return resolveId(data[field])
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const ContentNavigation: React.FC<{ context: CollectionContext }> = ({ context }) => {
  const { id: docId } = useDocumentInfo()

  // Read the direct parent relationship from form state
  const parentField = useFormFields(([fields]) =>
    context === 'exercises' ? fields.lesson : fields.chapter,
  )
  const parentId = resolveId(parentField?.value)

  const [hierarchy, setHierarchy] = useState<HierarchyData>({})
  const [loading, setLoading] = useState(false)

  const fetchHierarchy = useCallback(async () => {
    if (!parentId) {
      setHierarchy({})
      return
    }

    setLoading(true)

    try {
      if (context === 'exercises') {
        const lesson = await fetchRecord('lessons', parentId)
        let chapter: ParentRecord | null = null
        let course: ParentRecord | null = null

        if (lesson) {
          const chapterId = await fetchRelationshipId('lessons', parentId, 'chapter')
          if (chapterId) {
            chapter = await fetchRecord('chapters', chapterId)
            const courseId = await fetchRelationshipId('chapters', chapterId, 'course')
            if (courseId) {
              course = await fetchRecord('courses', courseId)
            }
          }
        }

        setHierarchy({ lesson, chapter, course })
      } else {
        const chapter = await fetchRecord('chapters', parentId)
        let course: ParentRecord | null = null

        if (chapter) {
          const courseId = await fetchRelationshipId('chapters', parentId, 'course')
          if (courseId) {
            course = await fetchRecord('courses', courseId)
          }
        }

        setHierarchy({ chapter, course })
      }
    } catch {
      setHierarchy({})
    } finally {
      setLoading(false)
    }
  }, [parentId, context])

  useEffect(() => {
    void fetchHierarchy()
  }, [fetchHierarchy])

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (!docId && !parentId) {
    return (
      <div className="py-3">
        <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--theme-elevation-800)]">
          Content Hierarchy
        </div>
        <p className="m-0 text-[13px] text-[var(--theme-elevation-500)]">
          Save the document to see navigation links.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-3">
        <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--theme-elevation-800)]">
          Content Hierarchy
        </div>
        <p className="m-0 text-[13px] text-[var(--theme-elevation-500)]">Loading hierarchy...</p>
      </div>
    )
  }

  // Build breadcrumb segments
  const breadcrumbs: { label: string; collection: string; id?: string }[] = []

  if (hierarchy.course?.id) {
    breadcrumbs.push({
      label: displayName(hierarchy.course),
      collection: 'courses',
      id: hierarchy.course.id,
    })
  } else if (context === 'exercises' || context === 'lessons') {
    breadcrumbs.push({ label: 'Not assigned', collection: 'courses' })
  }

  if (hierarchy.chapter?.id) {
    breadcrumbs.push({
      label: displayName(hierarchy.chapter),
      collection: 'chapters',
      id: hierarchy.chapter.id,
    })
  } else if (context === 'exercises' || context === 'lessons') {
    breadcrumbs.push({ label: 'Not assigned', collection: 'chapters' })
  }

  if (context === 'exercises') {
    if (hierarchy.lesson?.id) {
      breadcrumbs.push({
        label: displayName(hierarchy.lesson),
        collection: 'lessons',
        id: hierarchy.lesson.id,
      })
    } else {
      breadcrumbs.push({ label: 'Not assigned', collection: 'lessons' })
    }
  }

  return (
    <div className="py-3">
      <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--theme-elevation-800)]">
        Content Hierarchy
      </div>

      {/* Breadcrumb */}
      <nav
        className="mb-3 flex flex-wrap items-center gap-0.5 rounded bg-[var(--theme-elevation-50)] px-2.5 py-2 text-body-xs leading-relaxed"
        aria-label="Content hierarchy breadcrumb"
      >
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb.collection}-${i}`} className="inline-flex items-center">
            {i > 0 && (
              <span className="mx-0.5 text-[11px] text-[var(--theme-elevation-400)]">{' > '}</span>
            )}
            {crumb.id ? (
              <a
                href={adminUrl(crumb.collection, crumb.id)}
                className="font-medium text-[var(--theme-text)] no-underline hover:underline"
                title={`Go to ${crumb.label}`}
              >
                {crumb.label}
              </a>
            ) : (
              <span className="text-body-xs italic text-[var(--theme-elevation-400)]">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Parent links */}
      <div className="flex flex-col gap-1.5">
        {context === 'exercises' && (
          <ParentLink label="Lesson" record={hierarchy.lesson} collection="lessons" />
        )}
        <ParentLink label="Chapter" record={hierarchy.chapter} collection="chapters" />
        <ParentLink label="Course" record={hierarchy.course} collection="courses" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ParentLink sub-component                                           */
/* ------------------------------------------------------------------ */

const ParentLink: React.FC<{
  label: string
  record: ParentRecord | null | undefined
  collection: string
}> = ({ label, record, collection }) => {
  const name = displayName(record)

  return (
    <div className="flex items-baseline gap-1.5 text-[13px]">
      <span className="min-w-[56px] shrink-0 font-semibold text-[var(--theme-elevation-600)]">
        {label}:
      </span>
      {record?.id ? (
        <a
          href={adminUrl(collection, record.id)}
          className="break-words text-[var(--theme-text)] underline decoration-[var(--theme-elevation-300)] underline-offset-2"
          title={`Navigate to ${name}`}
        >
          {name}
        </a>
      ) : (
        <span className="text-body-xs italic text-[var(--theme-elevation-400)]">{name}</span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Exports — named wrappers for each collection                       */
/* ------------------------------------------------------------------ */

export const ExerciseNavigation: React.FC = () => <ContentNavigation context="exercises" />
export const LessonNavigation: React.FC = () => <ContentNavigation context="lessons" />

export default ContentNavigation
