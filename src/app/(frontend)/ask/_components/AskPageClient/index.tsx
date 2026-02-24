'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { NavigationBar } from '@/ui/web/homepage/NavigationBar'
import { RequireCourseSelection } from '@/ui/web/guards/RequireCourseSelection'
import { AskConversationGrid } from '../AskConversationGrid'
import { AskContent } from '../AskContent'

function AskPageInner() {
  const searchParams = useSearchParams()
  const chatParam = searchParams.get('chat')

  if (chatParam) {
    return <AskContent conversationId={chatParam === 'new' ? undefined : chatParam} />
  }

  return (
    <div>
      <NavigationBar />
      <AskConversationGrid />
    </div>
  )
}

export function AskPageClient() {
  return (
    <RequireCourseSelection>
      <Suspense>
        <AskPageInner />
      </Suspense>
    </RequireCourseSelection>
  )
}
