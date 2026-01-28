'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getUserProfile } from '@/client/state/localStorage/userProfile'

export function RequireCourseSelection({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [hasSelection, setHasSelection] = useState<boolean | null>(null)

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile?.gradeLevel) {
      router.replace('/')
      return
    }
    setHasSelection(true)
  }, [router])

  if (hasSelection === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return <>{children}</>
}
