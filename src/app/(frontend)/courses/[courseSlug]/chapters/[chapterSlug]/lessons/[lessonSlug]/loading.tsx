import { Spinner } from '@/infra/loading/components/Spinner'

/**
 * Lesson-specific loading component for the heaviest route
 * Displays a centered spinner while lesson content loads
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  )
}
