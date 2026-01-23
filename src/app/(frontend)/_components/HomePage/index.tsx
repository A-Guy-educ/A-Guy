'use client'

import { useState, useEffect } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { GreetingFlow } from '@/ui/web/homepage/GreetingFlow'
import { useRouter } from 'next/navigation'

export function HomePage() {
  const [showGreeting, setShowGreeting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile || !profile.gradeLevel) {
      setShowGreeting(true)
    } else {
      router.push('/study')
    }
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">טוען...</div>
      </div>
    )
  }

  if (showGreeting) {
    return <GreetingFlow onComplete={() => router.push('/study')} />
  }

  return null
}
