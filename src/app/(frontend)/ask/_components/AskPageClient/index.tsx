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
  const ctxParam = searchParams.get('ctx')

  if (chatParam) {
    // ctx param carries the contextKey for existing conversations
    // For "new", no contextKey → AskContent generates a fresh one
    return (
      <AskContent
        conversationContextKey={chatParam === 'new' ? undefined : (ctxParam ?? undefined)}
      />
    )
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
