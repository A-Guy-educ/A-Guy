'use client'

/**
 * Persona Selection Component
 *
 * A card-based selection UI for choosing a teacher persona during registration.
 * Allows users to select one of 5 personas or skip (defaults to persona_focused).
 *
 * @fileType component
 * @domain chat
 * @ai-summary Card-based persona selection for registration
 */

import { useState } from 'react'

import { Button } from '@/ui/web/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/web/components/card'
import { setPersonaCookieClient, DEFAULT_PERSONA_SLUG } from '@/infra/utils/persona-cookie-client'
import { cn } from '@/infra/utils/ui'

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

interface PersonaSelectionProps {
  onContinue: () => void
  onSkip?: () => void
  className?: string
  // Optional: provide a function to get translations
  getTranslation?: (key: string) => string
}

export function PersonaSelection({
  onContinue,
  onSkip,
  className,
  getTranslation = (key) => key, // Default: return key
}: PersonaSelectionProps) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSelect = (slug: string) => {
    setSelectedPersona(slug)
  }

  const handleContinue = async () => {
    const personaToSave = selectedPersona || DEFAULT_PERSONA_SLUG

    // Set the cookie for anonymous tracking
    setPersonaCookieClient(personaToSave)

    setIsLoading(true)
    try {
      onContinue()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    // Set default persona
    setPersonaCookieClient(DEFAULT_PERSONA_SLUG)

    if (onSkip) {
      onSkip()
    } else {
      onContinue()
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{getTranslation('personas.title')}</CardTitle>
          <CardDescription>{getTranslation('personas.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {personas.map((persona) => (
              <button
                key={persona.slug}
                type="button"
                onClick={() => handleSelect(persona.slug)}
                className={cn(
                  'text-left p-4 rounded-lg border-2 transition-all duration-200',
                  'hover:border-primary/50 hover:bg-primary/5',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  selectedPersona === persona.slug
                    ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2'
                    : 'border-border',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{persona.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{getTranslation(persona.titleKey)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getTranslation(persona.descriptionKey)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between">
          <Button variant="ghost" onClick={handleSkip} disabled={isLoading} type="button">
            {getTranslation('personas.skip')}
          </Button>
          <Button onClick={handleContinue} disabled={isLoading} type="button">
            {isLoading
              ? getTranslation('personas.continuing')
              : getTranslation('personas.continue')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
