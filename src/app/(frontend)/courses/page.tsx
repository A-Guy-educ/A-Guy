import { defaultLocale, getDirection } from '@/i18n/config'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { CourseCard } from './_components/CourseCard'
import { EmptyState } from './_components/EmptyState'
import { CourseShopHeader } from './_components/CourseShopHeader'
import { CourseCatalogHeader } from './_components/CourseCatalogHeader'

export const revalidate = 300 // ISR: revalidate every 5 minutes

export default async function CoursesPage() {
  const contentLocale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined
  const courses = await queryPublishedCourses(contentLocale)

  return (
    <div
      className="min-h-screen text-card-foreground antialiased"
      dir={getDirection(defaultLocale)}
    >
      {/* Store Header */}
      <CourseShopHeader />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Courses Section */}
        <section>
          <CourseCatalogHeader />

          {courses.length === 0 ? (
            <EmptyState type="noCourses" />
          ) : (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export function generateMetadata() {
  const isHebrew = defaultLocale === 'he'

  return {
    title: isHebrew ? 'חנות הקורסים - A-Guy' : 'Course Store - A-Guy',
    description: isHebrew
      ? 'בחר את התוכנית המתאימה לך והתקדם להצלחה במתמטיקה.'
      : 'Choose the right plan for you and advance in mathematics.',
  }
}
