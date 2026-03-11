'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { cookieName, defaultLocale, getDirection, type Locale, locales } from '@/i18n/config'

interface Messages {
  [key: string]: string | Messages
}

interface I18nContextType {
  locale: string
  messages: Messages
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

/**
 * Read the locale from the NEXT_LOCALE cookie (client-side only).
 * Falls back to defaultLocale if no cookie or invalid value.
 */
function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return defaultLocale
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`))
  const value = match?.[1] as Locale | undefined
  if (value && locales.includes(value)) return value
  return defaultLocale
}

type I18nProviderProps = {
  children: React.ReactNode
} & (
  | {
      /** All locale message bundles keyed by locale (ISR-compatible) */
      allMessages: Record<string, Messages>
      locale?: never
      messages?: never
    }
  | {
      /** Single locale + messages (legacy/test usage) */
      locale: string
      messages: Messages
      allMessages?: never
    }
)

export function I18nProvider(props: I18nProviderProps) {
  const { children } = props

  // Determine locale and messages based on which prop format was used
  const resolvedLocale = useMemo(() => {
    if (props.locale) return props.locale
    return getLocaleFromCookie()
  }, [props.locale])

  const resolvedMessages = useMemo(() => {
    if (props.messages) return props.messages
    if (props.allMessages) {
      return props.allMessages[resolvedLocale] ?? props.allMessages[defaultLocale] ?? {}
    }
    return {}
  }, [props.messages, props.allMessages, resolvedLocale])

  // Update <html> lang and dir to match resolved locale (only in allMessages mode)
  if (!props.locale && typeof document !== 'undefined') {
    const html = document.documentElement
    const dir = getDirection(resolvedLocale as Locale)
    if (html.lang !== resolvedLocale) html.lang = resolvedLocale
    if (html.dir !== dir) html.dir = dir
  }

  const t = useMemo(() => {
    return (key: string): string => {
      const keys = key.split('.')
      let value: string | Messages | undefined = resolvedMessages

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          value = undefined
          break
        }
      }

      return typeof value === 'string' ? value : key
    }
  }, [resolvedMessages])

  return (
    <I18nContext.Provider value={{ locale: resolvedLocale, messages: resolvedMessages, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export function useTranslations(namespace?: string) {
  const { t } = useI18n()
  return (key: string) => t(namespace ? `${namespace}.${key}` : key)
}

export function useLocale() {
  const { locale } = useI18n()
  return locale
}
