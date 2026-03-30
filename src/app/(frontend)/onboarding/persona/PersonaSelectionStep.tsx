'use client'

import { useEffect, useState } from 'react'

import { Spinner } from '@/infra/loading/components/Spinner'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { cn } from '@/infra/utils/ui'
import { Badge } from '@/ui/web/components/badge'
import { Button } from '@/ui/web/components/button'
import { Card } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import { toast } from 'sonner'
import { Users } from 'lucide-react'

const PERSONA_COOKIE_NAME = 'onboarding_persona'
const PERSONA_COOKIE_MAX_AGE = 600 // 10 minutes

interface TeacherProfile {
  slug: string
  label: string
  description: string
  isEnabled: boolean
}

interface PersonaSelectionStepProps {
  returnTo: string
}

export function PersonaSelectionStep({ returnTo }: PersonaSelectionStepProps) {
  const t = useTranslations('onboarding.persona')
  const router = useRouterWithLoading()
  const [profiles, setProfiles] = useState<TeacherProfile[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Restore selection from cookie on mount (handles page refresh)
  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${PERSONA_COOKIE_NAME}=([^;]+)`))
    if (match) {
      const slug = decodeURIComponent(match[1])
      if (/^[a-z0-9_-]+$/.test(slug)) {
        setSelectedSlug(slug)
      }
    }
  }, [])

  // Fetch profiles on mount
  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch('/api/teacher-profiles')
        if (res.ok) {
          const data = await res.json()
          if (data.profiles) {
            setProfiles(data.profiles)
          }
        }
      } catch {
        // profiles remain empty, skip/continue buttons still work
      } finally {
        setLoading(false)
      }
    }
    fetchProfiles()
  }, [])

  const handleSelect = (slug: string) => {
    setSelectedSlug(slug)
    document.cookie = `${PERSONA_COOKIE_NAME}=${slug}; path=/; max-age=${PERSONA_COOKIE_MAX_AGE}; SameSite=Lax`
  }

  const handleContinue = async () => {
    if (!selectedSlug || saving) return
    setSaving(true)

    try {
      const res = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherProfileSlug: selectedSlug }),
      })

      if (!res.ok) {
        toast.error(t('saveFailed'))
        setSaving(false)
        return
      }

      clearCookie()
      router.push(returnTo)
      router.refresh()
    } catch {
      toast.error(t('saveFailed'))
      setSaving(false)
    }
  }

  const handleSkip = () => {
    clearCookie()
    router.push(returnTo)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="container py-section-md">
        <div className="mx-auto max-w-2xl text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-section-md">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-display-sm font-bold mb-2">{t('title')}</h1>
          <p className="text-body-md text-muted-foreground">{t('subtitle')}</p>
        </div>

        {profiles.length > 0 ? (
          <div
            className="grid gap-content-gap sm:grid-cols-2"
            role="radiogroup"
            aria-label={t('title')}
          >
            {profiles.map((profile) => (
              <Card
                key={profile.slug}
                role="radio"
                aria-checked={selectedSlug === profile.slug}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelect(profile.slug)
                  }
                }}
                className={cn(
                  'cursor-pointer transition-all duration-normal hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedSlug === profile.slug
                    ? 'ring-2 ring-primary border-primary'
                    : 'border-border',
                )}
                onClick={() => handleSelect(profile.slug)}
              >
                <div className="p-card-padding">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{profile.label}</h3>
                    {selectedSlug === profile.slug && (
                      <Badge variant="secondary">{t('selected')}</Badge>
                    )}
                  </div>
                  <p className="text-body-sm text-muted-foreground">{profile.description}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-section-md">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-body-sm font-medium text-muted-foreground">{t('noProfiles')}</p>
          </div>
        )}

        <div className="flex justify-between items-center mt-8">
          <Button variant="ghost" onClick={handleSkip} disabled={saving}>
            {t('skip')}
          </Button>
          <Button onClick={handleContinue} disabled={!selectedSlug || saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                {t('saving')}
              </span>
            ) : (
              t('continue')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function clearCookie() {
  document.cookie = `${PERSONA_COOKIE_NAME}=; path=/; max-age=0`
}
