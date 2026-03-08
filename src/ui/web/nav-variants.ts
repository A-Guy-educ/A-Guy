import type { Header, Footer, Page } from '@/payload-types'

type NavItemLink = {
  type?: ('reference' | 'custom') | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages'
    value: string | Page
  } | null
  url?: string | null
  label: string
}

export type NavItem = {
  link: NavItemLink
  id?: string | null
}

/**
 * Select nav items from the variant matching the given system locale.
 * Falls back to the first variant if no match.
 *
 * Handles both old format (direct navItems field) and new format (variants array)
 * for backwards compatibility with existing database entries.
 */
export function getNavItemsForLocale(data: Header | Footer | undefined, locale: string): NavItem[] {
  // Handle new format with variants array
  const variants = data?.variants
  if (variants && variants.length > 0) {
    const matched = variants.find((v) => v.locale === locale) || variants[0]
    return (matched?.navItems as NavItem[]) || []
  }

  // Handle old format (backwards compatibility) - direct navItems field
  // This was the format before the content-locale feature was added
  return (data as unknown as { navItems?: NavItem[] })?.navItems || []
}
