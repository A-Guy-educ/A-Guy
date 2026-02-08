import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { CourseCard } from './_components/CourseCard'
import { EmptyState } from './_components/EmptyState'
import { MembershipPlans } from './_components/MembershipPlans'
import { CourseShopHeader } from './_components/CourseShopHeader'
import { CourseCatalogHeader } from './_components/CourseCatalogHeader'

export default async function CoursesPage() {
  const courses = await queryPublishedCourses()

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir="rtl">
      {/* Store Header */}
      <CourseShopHeader />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Membership Plans Section */}
        <MembershipPlans />

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

export async function generateMetadata() {
  return {
    title: 'חנות הקורסים - A-Guy',
    description: 'בחר את התוכנית המתאימה לך והתקדם להצלחה במתמטיקה.',
  }
}
