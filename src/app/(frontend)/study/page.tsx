import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { StudyContent } from './_components/StudyContent'
import { GradeRedirect } from './_components/GradeRedirect'
import { fetchStudyData } from '@/server/repos/queries/study-data'
import { defaultLocale } from '@/i18n/config'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'

interface StudyPageProps {
  searchParams: Promise<{ grade?: string }>
}

export default async function StudyPage({ searchParams }: StudyPageProps) {
  const params = await searchParams
  const grade = params.grade

  // No grade in URL — render client component that reads localStorage and redirects
  if (!grade) {
    return (
      <div>
        <NavigationBar />
        <GradeRedirect />
      </div>
    )
  }

  // Grade is known — fetch data server-side (same process, no API round-trip)
  const locale = isValidContentLocale(defaultLocale) ? defaultLocale : undefined
  const data = await fetchStudyData({ gradeLevel: grade, locale })

  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="learning" prefetchedData={data} />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'לימוד - A-Guy',
    description: 'בחר נושא ללימוד',
  }
}
