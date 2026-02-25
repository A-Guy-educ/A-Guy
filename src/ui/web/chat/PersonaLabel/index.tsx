'use client'

/**
 * Persona Label Component
 *
 * Displays the current teacher persona near the chat interface.
 * Uses next-intl for translations.
 *
 * @fileType component
 * @domain chat
 * @ai-summary Label showing current teacher persona in chat
 */

import { useState, useEffect } from 'react'
import { getPersonaCookieClient, DEFAULT_PERSONA_SLUG } from '@/infra/utils/persona-cookie-client'
import { cn } from '@/infra/utils/ui'

interface PersonaLabelProps {
  className?: string
}

export function PersonaLabel({ className }: PersonaLabelProps) {
  const [personaSlug, setPersonaSlug] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Read from cookie on mount
    const cookieValue = getPersonaCookieClient()
    setPersonaSlug(cookieValue || DEFAULT_PERSONA_SLUG)
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return null
  }

  // Get icon for persona
  const getPersonaIcon = (slug: string | undefined): string => {
    if (!slug) return '🎓'

    const slugToIcon: Record<string, string> = {
      persona_strict: '🎯',
      persona_thorough: '📚',
      persona_patient: '🌱',
      persona_focused: '🎓',
      persona_challenging: '🚀',
    }

    return slugToIcon[slug] || '🎓'
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'bg-secondary text-secondary-foreground text-xs font-medium',
        className,
      )}
      title="Current teaching style"
    >
      <span className="text-sm">{getPersonaIcon(personaSlug)}</span>
      <span className="whitespace-nowrap">{personaSlug?.replace('persona_', '') || 'Default'}</span>
    </div>
  )
}
