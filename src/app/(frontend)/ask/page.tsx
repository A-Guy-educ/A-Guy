import { RequireCourseSelection } from '@/ui/web/guards/RequireCourseSelection'
import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { AskContent } from './_components/AskContent'

export default function AskPage() {
  return (
    <RequireCourseSelection>
      <div>
        <NavigationBar />
        <AskContent />
      </div>
    </RequireCourseSelection>
  )
}

export async function generateMetadata() {
  return {
    title: 'שאל - A-Guy',
    description: 'שאל שאלות',
  }
}
