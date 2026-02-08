import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { CourseCard } from './_components/CourseCard'
import { EmptyState } from './_components/EmptyState'
import { MembershipPlans } from './_components/MembershipPlans'

export default async function CoursesPage() {
  const courses = await queryPublishedCourses()

  return (
    <div className="min-h-screen text-card-foreground antialiased" dir="rtl">
      {/* Store Header */}
      <header className="bg-card border-b border-border pt-12 pb-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-card-foreground mb-4" style={{ fontSize: '40px', fontWeight: 900 }}>
            <span className="block">חנות הקורסים</span>
            <span className="block text-muted-foreground" style={{ fontSize: '24px' }}>
              Course Shop
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto" style={{ fontSize: '18px' }}>
            בחר את התוכנית המתאימה לך והתקדם להצלחה במתמטיקה.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Membership Plans Section */}
        <MembershipPlans />

        {/* Courses Section */}
        <section>
          <div className="text-center mb-10">
            <h2
              className="text-card-foreground uppercase tracking-widest"
              style={{ fontSize: '24px', fontWeight: 900 }}
            >
              <span className="block">קטלוג קורסים</span>
              <span className="block text-muted-foreground" style={{ fontSize: '16px' }}>
                Course Catalog
              </span>
            </h2>
          </div>

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
