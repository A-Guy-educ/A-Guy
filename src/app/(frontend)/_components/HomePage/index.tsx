'use client'

import { useState, useEffect } from 'react'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
import { GreetingFlow } from '@/ui/web/homepage/GreetingFlow'
import { LandingPage } from '@/ui/web/homepage/LandingPage'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/ui/web/providers/I18n'

type HomeView = 'loading' | 'landing' | 'greeting'

export function HomePage() {
  const [view, setView] = useState<HomeView>('loading')
  const router = useRouter()
  const t = useTranslations('homepage.greeting')

  useEffect(() => {
    const profile = getUserProfile()
    if (profile?.gradeLevel) {
      router.push('/study')
    } else {
      setView('landing')
    }
  }, [router])

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  if (view === 'greeting') {
    return <GreetingFlow onComplete={() => router.push('/study')} />
  }

  return <LandingPage onGetStarted={() => setView('greeting')} />
}
