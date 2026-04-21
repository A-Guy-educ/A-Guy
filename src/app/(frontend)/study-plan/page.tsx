import { StudyPlanPage } from './_components/StudyPlanPage'

export default function StudyPlanRoute() {
  return <StudyPlanPage />
}

export async function generateMetadata() {
  return {
    title: 'תוכנית לימודים - A-Guy',
    description: 'תכנן את ה-7 ימים הקרובים ללימוד',
  }
}
