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

export interface Brand {
  config: BrandConfig
  // Future phases will extend this with:
  // Logo: ComponentType
  // pages: { LandingPage: ComponentType; StartPage: ComponentType }
  // components: { CourseCard: ComponentType }
  // messages: { en: Record<string, string>; he: Record<string, string> }
}
