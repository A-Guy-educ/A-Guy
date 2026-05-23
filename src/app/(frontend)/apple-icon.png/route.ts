/**
 * Apple Touch Icon route — serves the brand's apple-touch-icon.png
 *
 * Falls back to favicon.svg if no dedicated apple-touch-icon exists.
 *
 * @fileType api-route
 * @domain brands
 * @ai-summary Dynamic apple-touch-icon served from brand bundle.
 */

import { getBrandSlug } from '@/brands'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-static'

export async function GET() {
  const brandSlug = getBrandSlug()
  // Fall back to favicon.svg since no dedicated apple-touch-icon is in the bundle
  const filePath = join(process.cwd(), 'src', 'brands', brandSlug, 'assets', 'favicon.svg')
  const file = await readFile(filePath)

  return new Response(file, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
