import type { ComponentType, SVGProps } from 'react'

/**
 * Brand Bundle Types
 *
 * @fileType types
 * @domain brands
 * @ai-summary Brand interface contract for multi-brand support.
 */

export type BrandSlug = 'aguy' // union grows when a 2nd brand lands

export interface BrandConfig {
  slug: BrandSlug
  name: string // e.g. "A-Guy"
  legalName: string // e.g. "A-Guy"
  host: string // e.g. "https://www.aguy.co.il"
  supportEmail: string
  locale: string // BCP-47, e.g. "he-IL"
  defaultTitle: string
  titleTemplate: string // e.g. "%s | A-Guy"
  description: string
  shortDescription: string // for twitter/og
  keywords: string[]
  author: { name: string; url: string }
  themeColor: { light: string; dark: string }
  social: { twitterHandle?: string }
  ogImage: string // absolute URL or path under /api/media
  appleWebApp: { title: string }
}

export interface BrandMessages {
  en: Record<string, unknown>
  he: Record<string, unknown>
}

export interface Brand {
  config: BrandConfig
  Logo: ComponentType<SVGProps<SVGSVGElement>>
  messages: BrandMessages
}
