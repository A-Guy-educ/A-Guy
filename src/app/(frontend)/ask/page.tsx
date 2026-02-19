import { RequireCourseSelection } from '@/ui/web/guards/RequireCourseSelection'
import { AskContent } from './_components/AskContent'

export default function AskPage() {
  return (
    <RequireCourseSelection>
      <AskContent />
    </RequireCourseSelection>
  )
}

export async function generateMetadata() {
  return {
    title: 'שאל - A-Guy',
    description: 'שאל שאלות',
  }
}
