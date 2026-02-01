'use client'

import { ChatInterface } from '@/ui/web/chat'

interface NotebookChatProps {
  exerciseId: string
  lessonId?: string
  chapterId?: string
  courseId?: string
}

export function NotebookChat({ exerciseId, lessonId, chapterId, courseId }: NotebookChatProps) {
  return (
    <div className="h-full bg-card">
      <ChatInterface
        exerciseId={exerciseId}
        lessonId={lessonId}
        chapterId={chapterId}
        courseId={courseId}
        translationNamespace="courses"
        showQuickActions={true}
        showResetButton={true}
      />
    </div>
  )
}
