'use client'

/**
 * Persona Provider
 *
 * Provides the current teacher persona to child components.
 * Reads from cookie/client-side storage.
 *
 * @fileType provider
 * @domain chat
 * @ai-summary React context provider for teacher persona state
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getPersonaCookieClient, DEFAULT_PERSONA_SLUG } from '@/infra/utils/persona-cookie-client'

interface PersonaContextType {
  personaSlug: string | undefined
  isLoading: boolean
  setPersonaSlug: (slug: string) => void
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined)

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [personaSlug, setPersonaSlugState] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Read from cookie on mount
    const cookieValue = getPersonaCookieClient()
    setPersonaSlugState(cookieValue || DEFAULT_PERSONA_SLUG)
    setIsLoading(false)
  }, [])

  const setPersonaSlug = (slug: string) => {
    setPersonaSlugState(slug)
  }

  return (
    <PersonaContext.Provider value={{ personaSlug, isLoading, setPersonaSlug }}>
      {children}
    </PersonaContext.Provider>
  )
}

export function usePersona(): PersonaContextType {
  const context = useContext(PersonaContext)
  if (!context) {
    // Return defaults if not in provider (for SSR)
    return {
      personaSlug: DEFAULT_PERSONA_SLUG,
      isLoading: false,
      setPersonaSlug: () => {},
    }
  }
  return context
}
