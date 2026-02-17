import { LessonAnalytics } from '@/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonAnalytics'
import { getInteractiveDemoConfig } from '@/server/config/interactive-demo-config'
import { InteractiveDemoView } from './InteractiveDemoView'

interface InteractiveDemoGateProps {
  lessonId: string
  lessonTitle: string
  backUrl: string
  typewriterEnabled: boolean
}

export async function InteractiveDemoGate({
  lessonId,
  lessonTitle,
  backUrl,
  typewriterEnabled,
}: InteractiveDemoGateProps) {
  const config = await getInteractiveDemoConfig()
  
  // Debug logging to troubleshoot config issues
  console.debug('[InteractiveDemoGate] Config retrieved:', {
    enabled: config.enabled,
    enabledType: typeof config.enabled,
    rawConfig: config,
  })

  if (!config.enabled) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{lessonTitle}</h1>
        <p className="text-muted-foreground">
          {/* TODO: Add comingSoon translation */ 'This lesson type is coming soon'}
        </p>
      </div>
    )
  }

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
