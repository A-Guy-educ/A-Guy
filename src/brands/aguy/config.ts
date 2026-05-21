/**
 * A-Guy Brand Configuration
 *
 * @fileType brand-config
 * @domain brands
 * @ai-summary Static configuration for the A-Guy brand.
 */

import type { BrandConfig } from '../types'

export const aguyConfig: BrandConfig = {
  slug: 'aguy',
  name: 'A-Guy',
  legalName: 'A-Guy',
  host: 'https://www.aguy.co.il',
  supportEmail: 'office@guykoren.co.il',
  locale: 'he-IL',
  defaultTitle: 'A-Guy | תרגול מתמטיקה אינטראקטיבי',
  titleTemplate: '%s | A-Guy',
  description:
    'פלטפורמה לתרגול מתמטיקה עם שיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים ברורים שלב אחר שלב – בנויה להתקדמות עקבית ואמיתית.',
  shortDescription:
    'פלטפורמה לתרגול מתמטיקה עם שיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים ברורים שלב אחר שלב.',
  keywords: [],
  author: { name: 'A-Guy', url: 'https://www.aguy.co.il' },
  themeColor: { light: '#91262C', dark: '#0f172a' },
  social: { twitterHandle: '@aguy' },
  ogImage: 'https://www.aguy.co.il/api/media/file/telescope.4ee60378.svg',
  appleWebApp: { title: 'A-Guy' },
}
