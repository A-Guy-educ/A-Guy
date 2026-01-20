import { NavigationBar } from '@/components/HomePage/NavigationBar'
import { StudyContent } from '../study/_components/StudyContent'

export default function PracticePage() {
  return (
    <div>
      <NavigationBar />
      <StudyContent lessonType="practice" />
    </div>
  )
}

export async function generateMetadata() {
  return {
    title: 'תרגול - A-Guy',
    description: 'תרגל נושאים',
  }
}
