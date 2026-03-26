import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { CourseCard } from './_components/CourseCard'
import { EmptyState } from './_components/EmptyState'
import { CourseShopHeader } from './_components/CourseShopHeader'
import { CourseCatalogHeader } from './_components/CourseCatalogHeader'

// Revalidate every 60 seconds — courses rarely change
export const revalidate = 60

export default async function CoursesPage() {
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined
  const courses = await queryPublishedCourses(contentLocale)

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir={getDirection(locale)}>
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
            <div className="grid gap-content-gap-xl md:grid-cols-2 lg:grid-cols-3">
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

export async function generateMetadata() {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return {
    title: isHebrew ? 'חנות הקורסים - A-Guy' : 'Course Store - A-Guy',
    description: isHebrew
      ? 'בחר את התוכנית המתאימה לך והתקדם להצלחה במתמטיקה.'
      : 'Choose the right plan for you and advance in mathematics.',
  }
}
