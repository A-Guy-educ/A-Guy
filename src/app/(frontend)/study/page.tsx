import { NavigationBar } from '@/components/HomePage/NavigationBar'
import { StudyContent } from './_components/StudyContent'

export default function StudyPage() {
  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="learning" />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'לימוד - A-Guy',
    description: 'בחר נושא ללימוד',
  }
}
