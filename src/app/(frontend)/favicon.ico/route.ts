/**
 * Favicon ICO route — serves the brand's favicon.ico
 *
 * @fileType api-route
 * @domain brands
 * @ai-summary Dynamic favicon.ico served from brand bundle.
 */

import { getBrandSlug } from '@/brands'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-static'

export async function GET() {
  const brandSlug = getBrandSlug()
  const filePath = join(process.cwd(), 'src', 'brands', brandSlug, 'assets', 'favicon.ico')
  const file = await readFile(filePath)

  return new Response(file, {
    headers: {
      'Content-Type': 'image/x-icon',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
