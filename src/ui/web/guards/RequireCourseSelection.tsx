'use client'

import { useEffect, useState } from 'react'

import { getUserProfile } from '@/client/state/localStorage/userProfile'

export function RequireCourseSelection({ children }: { children: React.ReactNode }) {
  const [hasSelection, setHasSelection] = useState<boolean | null>(null)

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile?.gradeLevel) {
      window.location.replace('/')
      return
    }
    setHasSelection(true)
  }, [])

  if (hasSelection === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
