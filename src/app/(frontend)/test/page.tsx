import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { StudyContent } from '../study/_components/StudyContent'

export default function TestPage() {
  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="exam" />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'מבחן - A-Guy',
    description: 'התכונן למבחנים',
  }
}
