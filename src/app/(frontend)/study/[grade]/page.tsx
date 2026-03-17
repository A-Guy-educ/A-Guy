import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { StudyContent } from '../_components/StudyContent'
import { fetchStudyData } from '@/server/repos/queries/study-data'
import { queryPublishedCourses } from '@/server/repos/queries/courses'
import { defaultLocale } from '@/i18n/config'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'

export const revalidate = 300 // ISR: revalidate every 5 minutes

interface StudyGradePageProps {
  params: Promise<{ grade: string }>
}

export default async function StudyGradePage({ params }: StudyGradePageProps) {
  const { grade } = await params
  const locale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined
  const data = await fetchStudyData({ gradeLevel: grade, locale })

  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="learning" prefetchedData={data} />
    </div>
  )
}

/**
 * Pre-render a page for every courseLabel at build time.
 * New grades added later are handled by ISR (revalidate above).
 */
export async function generateStaticParams() {
  const locale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined
  const courses = await queryPublishedCourses(locale)

  return courses
    .map((course) => course.courseLabel)
    .filter((label): label is string => Boolean(label))
    .map((grade) => ({ grade }))
}

export async function generateMetadata({ params }: StudyGradePageProps) {
  const { grade } = await params
  return {
    title: `לימוד כיתה ${grade} - A-Guy`,
    description: `נושאי לימוד לכיתה ${grade}`,
  }
}
