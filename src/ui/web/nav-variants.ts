import type { Header, Footer } from '@/payload-types'

/**
 * Select nav items from the variant matching the given system locale.
 * Falls back to the first variant if no match.
 */
export function getNavItemsForLocale(data: Header | Footer | undefined, locale: string) {
  const variants = data?.variants || []
  const matched = variants.find((v) => v.locale === locale) || variants[0]
  return matched?.navItems || []
}
