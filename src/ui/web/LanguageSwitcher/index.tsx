'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import { cookieName, getDirection, isForcedLocaleDomain, type Locale, locales } from '@/i18n/config'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isMobileDevice } from '@/infra/utils/ui'

export function LanguageSwitcher() {
  const t = useTranslations('common.languageSwitcher')
  const serverLocale = useLocale()
  const router = useRouter()

  // Client-side locale state for immediate UI updates (like Theme provider pattern)
  // This provides instant feedback while router.refresh() syncs with server
  const [clientLocale, setClientLocale] = useState<Locale>(serverLocale as Locale)
  // Track if we're on a mobile device for native select rendering
  const [isMobile, setIsMobile] = useState(false)

  // Sync client state with server locale on mount or when server locale changes
  useEffect(() => {
    setClientLocale(serverLocale as Locale)
  }, [serverLocale])

  // Detect mobile device on mount
  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  const handleLocaleChange = (newLocale: string) => {
    if (!locales.includes(newLocale as Locale)) return

    // PREVIOUS IMPLEMENTATION PATTERN: Mix of middleware + client cache
    // 1. Update client-side state immediately for instant UI feedback (client cache)
    setClientLocale(newLocale as Locale)

    // 2. Update HTML attributes immediately (instant RTL/LTR visual feedback)
    // This matches the Theme provider pattern for instant client-side updates
    document.documentElement.setAttribute('lang', newLocale)
    document.documentElement.setAttribute('dir', getDirection(newLocale as Locale))

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
    typeof window !== 'undefined' && isForcedLocaleDomain(window.location.host)

  const localeLabels: Record<Locale, string> = {
    en: t('english'),
    he: t('hebrew'),
  }

  // On mobile, use native select for better touch interaction
  if (isMobile) {
    return (
      <div className="flex items-center gap-2">
        <select
          value={displayLocale}
          onChange={(e) => handleLocaleChange(e.target.value)}
          disabled={isOnForcedDomain}
          className="flex h-10 w-[150px] items-center justify-between rounded border border-input bg-elevated px-3 py-2 text-inherit ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('label')}
        >
          {locales.map((loc) => (
            <option key={loc} value={loc}>
              {localeLabels[loc]}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // On desktop, use custom Radix UI Select for better styling
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
