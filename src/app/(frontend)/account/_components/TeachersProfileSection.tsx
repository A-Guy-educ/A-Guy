'use client'

import { useEffect, useState } from 'react'

import { Badge } from '@/ui/web/components/badge'
import { Card } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import { toast } from 'sonner'

interface TeacherProfile {
  slug: string
  label: string
  description: string
  isEnabled: boolean
}

export function TeachersProfileSection() {
  const t = useTranslations('auth.account.teacherProfile')
  const [profiles, setProfiles] = useState<TeacherProfile[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch profiles and current selection on mount
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch profiles and settings in parallel
        const [profilesRes, settingsRes] = await Promise.all([
          fetch('/api/teacher-profiles'),
          fetch('/api/user-settings'),
        ])

        // Check for auth errors
        if (profilesRes.status === 401 || settingsRes.status === 401) {
          setLoading(false)
          return
        }

        const profilesData = await profilesRes.json()
        const settingsData = await settingsRes.json()

        if (profilesData.profiles) {
          setProfiles(profilesData.profiles)
        }

        if (settingsData.settings?.teacherProfile) {
          setSelectedSlug(settingsData.settings.teacherProfile.slug)
        }
      } catch (error) {
        console.error('Failed to fetch teacher profiles:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSelect = async (slug: string) => {
    if (saving) return
    setSaving(true)

    try {
      const res = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacherProfileSlug: slug }),
      })

      if (!res.ok) {
        toast.error(t('changeFailed'))
        return
      }

      setSelectedSlug(slug)
      toast.success(t('changeSuccess'))
    } catch (error) {
      console.error('Failed to update teacher profile:', error)
      toast.error(t('changeFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="py-4">
        <p className="text-muted-foreground">{t('noProfiles')}</p>
      </div>
    )
  }

  return (
    <div className="py-4 space-y-4">
      <p className="text-sm text-muted-foreground">{t('description')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map((profile) => (
          <Card
            key={profile.slug}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              selectedSlug === profile.slug ? 'ring-2 ring-primary border-primary' : 'border-border'
            }`}
            onClick={() => handleSelect(profile.slug)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{profile.label}</h3>
                {selectedSlug === profile.slug && (
                  <Badge variant="secondary">{t('selected')}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
