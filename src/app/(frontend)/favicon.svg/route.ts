/**
 * Favicon SVG route — serves the brand's favicon.svg
 *
 * @fileType api-route
 * @domain brands
 * @ai-summary Dynamic favicon.svg served from brand bundle.
 */

import { getBrandSlug } from '@/brands'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-static'

export async function GET() {
  const brandSlug = getBrandSlug()
  const filePath = join(process.cwd(), 'src', 'brands', brandSlug, 'assets', 'favicon.svg')
  const file = await readFile(filePath)

  return new Response(file, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
