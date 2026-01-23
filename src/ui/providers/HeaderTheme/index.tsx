'use client'

import type { Theme } from '@/ui/providers/Theme/types'

import React, { createContext, useCallback, use, useState } from 'react'

import { useTheme } from '@/ui/providers/Theme'

export interface ContextType {
  headerTheme?: Theme | null
  setHeaderTheme: (theme: Theme | null) => void
}

const initialContext: ContextType = {
  headerTheme: undefined,
  setHeaderTheme: () => null,
}

const HeaderThemeContext = createContext(initialContext)

export const HeaderThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Get the main theme from ThemeProvider
  const { theme: mainTheme } = useTheme()

  // Local state for per-page overrides (null means use main theme)
  const [overrideTheme, setOverrideTheme] = useState<Theme | null | undefined>(undefined)

  const setHeaderTheme = useCallback((themeToSet: Theme | null) => {
    // null means reset to main theme, so set to undefined
    setOverrideTheme(themeToSet === null ? undefined : themeToSet)
  }, [])

  // Determine the effective header theme:
  // - If overrideTheme is set (not undefined), use it
  // - Otherwise (undefined), use the main theme
  const headerTheme = overrideTheme !== undefined ? overrideTheme : mainTheme

  return <HeaderThemeContext value={{ headerTheme, setHeaderTheme }}>{children}</HeaderThemeContext>
}

export const useHeaderTheme = (): ContextType => use(HeaderThemeContext)
