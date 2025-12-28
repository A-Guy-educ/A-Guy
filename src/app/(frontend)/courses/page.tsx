import { queryPublishedCourses } from '@/lib/queries/courses'
import { CourseCard } from '@/components/courses/CourseCard'
import { EmptyState } from '@/components/courses/EmptyState'
import { CoursesPageTitle } from '@/components/courses/CoursesPageTitle'

export default async function CoursesPage() {
  const courses = await queryPublishedCourses()

  return (
    <div className="container mx-auto px-4 py-8">
      <CoursesPageTitle />

      {courses.length === 0 ? (
        <EmptyState type="noCourses" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'Courses',
    description: 'Browse all available courses',
  }
}
