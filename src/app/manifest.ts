/**
 * Web App Manifest — served at /manifest.webmanifest
 *
 * @fileType special-file
 * @domain brands
 * @ai-summary Dynamic web app manifest built from brand config.
 */

import type { MetadataRoute } from 'next'

import { getBrand } from '@/brands'

export default function manifest(): MetadataRoute.Manifest {
  const b = getBrand().config
  return {
    name: b.name,
    short_name: b.name,
    description: b.shortDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: b.themeColor.light,
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
  }
}
