import { queryPublishedCourses } from '@/lib/queries/courses'
import { CourseCard } from './_components/CourseCard'
import { EmptyState } from './_components/EmptyState'
import { CoursesHero } from './_components/CoursesHero'

export default async function CoursesPage() {
  const courses = await queryPublishedCourses()

  return (
    <div className="min-h-screen">
      <CoursesHero />

      <div className="container mx-auto px-4 py-12 md:py-16">
        {courses.length === 0 ? (
          <EmptyState type="noCourses" />
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Featured Courses
              </h2>
              <p className="text-muted-foreground">
                Hand-picked courses to help you on your learning journey.
              </p>
            </div>

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
