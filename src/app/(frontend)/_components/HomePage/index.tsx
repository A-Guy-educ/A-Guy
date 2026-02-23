'use client'

import { useState, useEffect } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { GreetingFlow } from '@/ui/web/homepage/GreetingFlow'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/ui/web/providers/I18n'

export function HomePage() {
  const [showGreeting, setShowGreeting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const t = useTranslations('homepage.greeting')

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
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  if (showGreeting) {
    return <GreetingFlow onComplete={() => router.push('/study')} />
  }

  return null
}
