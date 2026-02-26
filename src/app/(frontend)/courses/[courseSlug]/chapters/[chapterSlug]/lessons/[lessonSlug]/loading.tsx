import { Spinner } from '@/infra/loading/components/Spinner'

/**
 * Lesson page loading component
 * Displays a spinner while the lesson page loads
 * Provides specific loading UI for the heaviest route
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  )
}
