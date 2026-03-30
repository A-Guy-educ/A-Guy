import { cookies } from 'next/headers'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { GRADE_COOKIE_NAME } from '@/client/state/localStorage/userProfile'
import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { StudyContent } from '../study/_components/StudyContent'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

export default async function PracticePage() {
  const cookieStore = await cookies()
  const grade = cookieStore.get(GRADE_COOKIE_NAME)?.value
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  const prefetchedData = grade ? await prefetchStudyData(grade, contentLocale) : null

  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="practice" prefetchedData={prefetchedData} />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'תרגול - A-Guy',
    description: 'תרגל נושאים',
  }
}
