'use client'

import { useEffect } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'

/**
 * Reads grade from localStorage, sets a cookie for middleware,
 * then reloads so middleware can rewrite /study → /study/[grade].
 * Shown only when no grade cookie exists yet.
 */
export function GradeRedirect() {
  useEffect(() => {
    const profile = getUserProfile()
    if (profile?.gradeLevel) {
      // Set cookie so middleware can rewrite /study on future visits
      document.cookie = `a-guy-grade=${encodeURIComponent(profile.gradeLevel)};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
      // Reload — middleware will now rewrite /study to /study/[grade]
      window.location.replace('/study')
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
