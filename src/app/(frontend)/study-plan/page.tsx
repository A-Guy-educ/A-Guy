import { pageMetadata } from '@/infra/seo/pageMetadata'
import { StudyPlanPage } from './_components/StudyPlanPage'

export default function StudyPlanRoute() {
  return <StudyPlanPage />
}

export async function generateMetadata() {
  return pageMetadata({
    title: 'תוכנית לימודים',
    description: 'תכנן את ה-7 ימים הקרובים ללימוד',
  })
}
