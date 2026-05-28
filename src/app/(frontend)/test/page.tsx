import { cookies } from 'next/headers'
import { getSystemLocale } from '@/i18n/server-locale'
import { isValidContentLocale } from '@/server/payload/fields/contentLocale'
import { GRADE_COOKIE_NAME } from '@/client/state/localStorage/userProfile'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { StudyContent } from '../study/_components/StudyContent'
import { prefetchStudyData } from '@/server/repos/queries/study-page'

export default async function TestPage() {
  const cookieStore = await cookies()
  const grade = cookieStore.get(GRADE_COOKIE_NAME)?.value
  const locale = await getSystemLocale()
  const contentLocale = isValidContentLocale(locale) ? locale : undefined

  // Note: no lessonType argument → defaults to 'practice' to match Practice page behavior
  const prefetchedData = grade ? await prefetchStudyData(grade, contentLocale) : null

  return (
    <div>
      <StudyContent lessonType="practice" prefetchedData={prefetchedData} />
    </div>
  )
}

export async function generateMetadata() {
  return pageMetadata({
    title: 'מבחן',
    description: 'התכונן למבחנים',
  })
}
