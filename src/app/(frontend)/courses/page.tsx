import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { CourseCard } from './_components/CourseCard'
import { EmptyState } from './_components/EmptyState'
import { CoursesPageTitle } from './_components/CoursesPageTitle'

export default async function CoursesPage() {
  const courses = await queryPublishedCourses()

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12 md:py-16">
        {courses.length === 0 ? (
          <EmptyState type="noCourses" />
        ) : (
          <>
            <CoursesPageTitle />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'Courses',
    description: 'Browse all available courses',
  }
}
