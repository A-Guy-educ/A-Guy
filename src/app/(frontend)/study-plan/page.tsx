import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { StudyPlanPage } from './_components/StudyPlanPage'

export default function StudyPlanRoute() {
  return (
    <div>
      <NavigationBar />
      <StudyPlanPage />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'תוכנית לימודים - A-Guy',
    description: 'תכנן את ה-7 ימים הקרובים ללימוד',
  }
}
