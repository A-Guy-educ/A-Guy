/**
 * Brand-Aware Web App Manifest
 *
 * Returns brand-specific manifest JSON for PWA installation.
 * The manifest values are sourced from the active brand bundle so that
 * brand identity (name, theme color, icons) is reflected in the PWA without
 * any hardcoded strings.
 *
 * @fileType api-route
 * @domain brands
 * @ai-summary Dynamic web app manifest powered by getBrand().
 */

import { getBrand } from '@/brands'
import { NextResponse } from 'next/server'

export const GET = async () => {
  const { config } = getBrand()

  const body = {
    name: config.name,
    short_name: config.name,
    description: config.description,
    start_url: config.host,
    display: 'standalone',
    background_color: config.themeColor.light,
    theme_color: config.themeColor.light,
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
    categories: ['education'],
    lang: config.locale,
    dir: config.locale.startsWith('he') ? 'rtl' : 'ltr',
  }

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
