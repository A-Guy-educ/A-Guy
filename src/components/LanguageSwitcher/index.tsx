'use client'

import { useLocale, useTranslations } from '@/providers/I18n'
import { cookieName, type Locale, locales } from '@/i18n/config'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function LanguageSwitcher() {
  const t = useTranslations('common.languageSwitcher')
  const serverLocale = useLocale()
  const router = useRouter()

  // Client-side locale state for immediate UI updates (like Theme provider pattern)
  // This provides instant feedback while router.refresh() syncs with server
  const [clientLocale, setClientLocale] = useState<Locale>(serverLocale as Locale)

  // Sync client state with server locale on mount or when server locale changes
  useEffect(() => {
    setClientLocale(serverLocale as Locale)
  }, [serverLocale])

  const handleLocaleChange = (newLocale: string) => {
    if (!locales.includes(newLocale as Locale)) return

    // PREVIOUS IMPLEMENTATION PATTERN: Mix of middleware + client cache
    // 1. Update client-side state immediately for instant UI feedback (client cache)
    setClientLocale(newLocale as Locale)

    // 2. Update HTML attributes immediately (instant RTL/LTR visual feedback)
    // This matches the Theme provider pattern for instant client-side updates
    document.documentElement.setAttribute('lang', newLocale)
    document.documentElement.setAttribute('dir', newLocale === 'he' ? 'rtl' : 'ltr')

    // 3. Set the locale cookie (source of truth for middleware)
    document.cookie = `${cookieName}=${newLocale}; path=/; max-age=31536000; samesite=lax`

    // 4. Use router.refresh() like the previous implementation
    // This triggers a soft refresh that:
    // - Sends the cookie with the request
    // - Middleware (if triggered) reads cookie and sets x-locale header
    // - Layout (now fixed to read header OR cookie) re-renders with correct locale
    // - Client state already updated, so UI is instant while server syncs
    //
    // Why this should work better now:
    // - Layout now reads from middleware header (x-locale) OR cookie as fallback
    // - Even if middleware doesn't run, layout will read cookie directly
    // - Client-side state provides instant feedback while server catches up
    router.refresh()
  }

  // Use client locale for display (immediate updates), but sync with server
  const displayLocale = clientLocale

  // Check if we're on a forced locale subdomain
  const isOnForcedDomain =
    typeof window !== 'undefined' &&
    (window.location.host.startsWith('he.') || window.location.host.startsWith('en.'))

  const localeLabels: Record<Locale, string> = {
    en: t('english'),
    he: t('hebrew'),
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={displayLocale} onValueChange={handleLocaleChange} disabled={isOnForcedDomain}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder={t('label')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {locales.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {localeLabels[loc]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
