'use client'

/**
 * Persona Selector Component
 *
 * A selector UI for changing the teacher persona in profile settings.
 * Uses Server Actions for mutation and toast for confirmation.
 *
 * @fileType component
 * @domain chat
 * @ai-summary Persona selector for profile settings with toast confirmation
 */

import { useState } from 'react'

import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/web/components/card'
import { setPersonaCookieClient, DEFAULT_PERSONA_SLUG } from '@/infra/utils/persona-cookie-client'
import { cn } from '@/infra/utils/ui'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

// Persona data for the UI
const personas = [
  {
    slug: 'persona_strict',
    titleKey: 'personas.strict.title',
    descriptionKey: 'personas.strict.description',
    icon: '🎯',
  },
  {
    slug: 'persona_thorough',
    titleKey: 'personas.thorough.title',
    descriptionKey: 'personas.thorough.description',
    icon: '📚',
  },
  {
    slug: 'persona_patient',
    titleKey: 'personas.patient.title',
    descriptionKey: 'personas.patient.description',
    icon: '🌱',
  },
  {
    slug: 'persona_focused',
    titleKey: 'personas.focused.title',
    descriptionKey: 'personas.focused.description',
    icon: '🎯',
  },
  {
    slug: 'persona_challenging',
    titleKey: 'personas.challenging.title',
    descriptionKey: 'personas.challenging.description',
    icon: '🚀',
  },
]

interface PersonaSelectorProps {
  currentPersonaSlug?: string
  className?: string
  getTranslation?: (key: string) => string
}

export function PersonaSelector({
  currentPersonaSlug = DEFAULT_PERSONA_SLUG,
  className,
  getTranslation = (key) => key,
}: PersonaSelectorProps) {
  const [selectedPersona, setSelectedPersona] = useState<string>(currentPersonaSlug)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSelect = (slug: string) => {
    setSelectedPersona(slug)
  }

  const handleSave = async () => {
    if (selectedPersona === currentPersonaSlug) {
      return // No change
    }

    setIsLoading(true)
    try {
      // Set the cookie first (for immediate effect)
      setPersonaCookieClient(selectedPersona)

      // Call the server action to save to database
      const response = await fetch('/api/persona/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaSlug: selectedPersona }),
      })

      if (response.ok) {
        toast.success(getTranslation('personas.saved'))
        router.refresh()
      } else {
        toast.error(getTranslation('personas.saveFailed'))
      }
    } catch (error) {
      console.error('Error saving persona:', error)
      toast.error(getTranslation('personas.saveFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanged = selectedPersona !== currentPersonaSlug

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{getTranslation('personas.settingsTitle')}</CardTitle>
        <CardDescription>{getTranslation('personas.settingsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {personas.map((persona) => (
            <button
              key={persona.slug}
              type="button"
              onClick={() => handleSelect(persona.slug)}
              className={cn(
                'text-left p-3 rounded-lg border-2 transition-all duration-200',
                'hover:border-primary/50 hover:bg-primary/5',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                selectedPersona === persona.slug
                  ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2'
                  : 'border-border',
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{persona.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{getTranslation(persona.titleKey)}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {getTranslation(persona.descriptionKey)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {hasChanged && (
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedPersona(currentPersonaSlug)}
              disabled={isLoading}
            >
              {getTranslation('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? getTranslation('common.saving') : getTranslation('personas.save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
