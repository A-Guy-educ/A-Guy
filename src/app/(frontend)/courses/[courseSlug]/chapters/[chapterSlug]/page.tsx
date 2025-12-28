import { notFound } from 'next/navigation'
import { queryCourseBySlug } from '@/lib/queries/courses'
import { queryChapterBySlug } from '@/lib/queries/chapters'
import { queryLessonsByChapter } from '@/lib/queries/lessons'
import { Breadcrumb } from '../../../_components/Breadcrumb'
import { LessonCard } from '../../../_components/LessonCard'
import { EmptyState } from '../../../_components/EmptyState'

interface ChapterPageProps {
  params: Promise<{
    courseSlug: string
    chapterSlug: string
  }>
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { courseSlug, chapterSlug } = await params

  const [course, chapter] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryChapterBySlug({ slug: chapterSlug }),
  ])

  if (!course || !chapter) {
    notFound()
  }

  // Verify chapter belongs to this course
  const chapterCourse = typeof chapter.course === 'string' ? null : chapter.course

  if (!chapterCourse || chapterCourse.id !== course.id) {
    notFound()
  }

  const lessons = await queryLessonsByChapter({ chapterId: chapter.id })

  const breadcrumbItems = [
    { label: 'Courses', href: '/courses' },
    { label: course.title, href: `/courses/${courseSlug}` },
    { label: chapter.title },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {chapter.chapterLabel && (
            <span className="text-sm font-semibold text-gray-500">
              Chapter {chapter.chapterLabel}
            </span>
          )}
        </div>
        <h1 className="text-4xl font-bold mb-4">{chapter.title}</h1>
        {chapter.description && <p className="text-xl text-gray-600">{chapter.description}</p>}
      </div>

      <section>
        <h2 className="text-2xl font-bold mb-4">Lessons</h2>

        {lessons.length === 0 ? (
          <EmptyState type="noLessons" />
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                courseSlug={courseSlug}
                chapterSlug={chapterSlug}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export async function generateMetadata({ params }: ChapterPageProps) {
  const { courseSlug, chapterSlug } = await params

  const [course, chapter] = await Promise.all([
    queryCourseBySlug({ slug: courseSlug }),
    queryChapterBySlug({ slug: chapterSlug }),
  ])

  if (!course || !chapter) {
    return {
      title: 'Chapter Not Found',
    }
  }

  const chapterCourse = typeof chapter.course === 'string' ? null : chapter.course

  if (!chapterCourse || chapterCourse.id !== course.id) {
    return {
      title: 'Chapter Not Found',
    }
  }

  return {
    title: `${chapter.title} - ${course.title}`,
    description: chapter.description || `Chapter: ${chapter.title}`,
  }
}
