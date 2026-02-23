/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page - for now allows access, auth can be added later
 */
'use client'

import { useState, useEffect } from 'react'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'

export default function CodyPage() {
  // For now, allow access to dashboard without auth
  // Auth can be added later once GITHUB_TOKEN is configured
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Skip auth check for now - dashboard is open access
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <CodyDashboard />
}
