'use client'

import { useAuth } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getUserProfile } from '@/client/state/localStorage/userProfile'

export function RequireCourseSelection({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user } = useAuth()
  const [hasSelection, setHasSelection] = useState<boolean | null>(null)

  useEffect(() => {
    const profile = getUserProfile()
    // If no gradeLevel, check if user is authenticated
    if (!profile?.gradeLevel) {
      // Authenticated users should see the page (with greeting flow if needed)
      // instead of being silently redirected to /start
      if (user) {
        setHasSelection(true)
        return
      }
      // Unauthenticated guests are redirected to /
      router.replace('/')
      return
    }
    setHasSelection(true)
  }, [router, user])

  if (hasSelection === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
