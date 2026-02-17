import { LessonAnalytics } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonAnalytics'
import { InteractiveDemoView } from './InteractiveDemoView'

interface InteractiveDemoGateProps {
  lessonId: string
  lessonTitle: string
  backUrl: string
  typewriterEnabled: boolean
  isInteractiveDemoEnabled: boolean
}

export async function InteractiveDemoGate({
  lessonId,
  lessonTitle,
  backUrl,
  typewriterEnabled,
  isInteractiveDemoEnabled,
}: InteractiveDemoGateProps) {
  // TEMPORARY DEBUG LOGGING (per requirement #1)
  console.log('[InteractiveDemoGate] Debug values:', {
    isInteractiveDemoEnabled,
    'typeof isInteractiveDemoEnabled': typeof isInteractiveDemoEnabled,
    'showComingSoon': !isInteractiveDemoEnabled,
  })

  // Per requirement #3: Show "Coming Soon" only when interactive_demo is NOT enabled
  if (!isInteractiveDemoEnabled) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{lessonTitle}</h1>
        <p className="text-muted-foreground">
          {/* TODO: Add comingSoon translation */ 'This lesson type is coming soon'}
        </p>
      </div>
    )
  }

  // Per requirement #4: Render Interactive Demo when enabled
  return (
    <>
      <LessonAnalytics lessonId={lessonId} courseId={''} lessonTitle={lessonTitle} />
      <InteractiveDemoView
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        backUrl={backUrl}
        typewriterEnabled={typewriterEnabled}
      />
    </>
  )
}
