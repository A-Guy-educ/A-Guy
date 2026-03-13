'use client'

import { useEffect } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'

/**
 * Reads grade from localStorage and redirects to /study?grade=X.
 * Shown only when no grade searchParam is provided.
 */
export function GradeRedirect() {
  useEffect(() => {
    const profile = getUserProfile()
    if (profile?.gradeLevel) {
      window.location.replace(`/study?grade=${encodeURIComponent(profile.gradeLevel)}`)
    } else {
      window.location.replace('/')
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center text-muted-foreground">טוען...</div>
    </div>
  )
}
