import { RESPONSE_HEADERS } from '@/infra/pdfjs/config'
import { renderViewerHtml, rewriteCss, validateRewrittenHtml } from '@/infra/pdfjs/renderer'
import { loadViewerCss, loadViewerTemplate } from '@/infra/pdfjs/template-loader'
import { redactUrl, validateFileUrl } from '@/infra/pdfjs/validator'
import { logger } from '@/infra/utils/logger'
import { NextRequest, NextResponse } from 'next/server'

/**
 * PDF.js Viewer Proxy
 *
 * Proxies the viewer.html from Vercel Blob CDN and serves it with proper headers
 * for iframe embedding. Rewrites asset URLs to point to Blob CDN.
 *
 * This proxy:
 * 1. Validates the file parameter for security
 * 2. Fetches viewer.html and viewer.css from Blob CDN (with caching)
 * 3. Rewrites relative URLs to absolute Blob CDN URLs
 * 4. Inlines CSS with rewritten image paths
 * 5. Serves with Content-Type: text/html for inline display
 *
 * Security:
 * - Strict validation of file parameter (same-origin or Vercel Blob only)
 * - No inline script injection
 * - Uses PDF.js native file loading via query parameter
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const reqLogger = logger.child({ requestId, component: 'pdfjs-viewer' })

  // Parse and validate file parameter
  const fileParam = request.nextUrl.searchParams.get('file')
  const requestOrigin = request.nextUrl.origin

  reqLogger.debug(
    { fileParam: fileParam ? redactUrl(fileParam) : null },
    'Processing viewer request',
  )

  const validation = validateFileUrl(fileParam, requestOrigin)

  if (!validation.valid) {
    reqLogger.warn(
      {
        error: validation.error.type,
        message: validation.error.message,
        fileParam: fileParam ? redactUrl(fileParam) : null,
      },
      'Invalid file parameter',
    )

    return NextResponse.json(
      { error: 'Invalid file URL', details: validation.error.message },
      { status: 400 },
    )
  }

  const validatedFileUrl = validation.url
  reqLogger.debug({ fileUrl: redactUrl(validatedFileUrl) }, 'File URL validated')

  try {
    // Load viewer template
    const templateResult = await loadViewerTemplate()
    if (!templateResult.ok) {
      reqLogger.error(
        { status: templateResult.status, statusText: templateResult.statusText },
        'Failed to fetch viewer HTML from CDN',
      )
      return NextResponse.json({ error: 'PDF viewer upstream unavailable' }, { status: 502 })
    }

    // Load viewer CSS
    const cssResult = await loadViewerCss()
    if (!cssResult.ok) {
      reqLogger.error(
        { status: cssResult.status, statusText: cssResult.statusText },
        'Failed to fetch viewer CSS from CDN',
      )
      return NextResponse.json({ error: 'PDF viewer upstream unavailable' }, { status: 502 })
    }

    // Rewrite CSS to fix image paths
    const rewrittenCss = rewriteCss(cssResult.css)

    // Render final HTML
    const html = await renderViewerHtml(templateResult.html, rewrittenCss)

    // Validate rewrite was successful
    const validation = await validateRewrittenHtml(html)
    if (!validation.valid) {
      reqLogger.error({ issues: validation.issues }, 'HTML rewrite validation failed')
      return NextResponse.json({ error: 'PDF viewer rendering error' }, { status: 500 })
    }

    // Note: The file URL is already passed via the iframe's query string (?file=...)
    // PDF.js viewer reads the file parameter from window.location.search natively
    // No need for any script injection - the iframe's src already contains ?file=<url>
    // This avoids both:
    // 1. Object.defineProperty crash (not configurable in modern browsers)
    // 2. Cross-origin PDF.js rejection (URL is same-origin via /api/media/file/ proxy)

    reqLogger.info(
      { fileUrl: redactUrl(validatedFileUrl), htmlSize: html.length },
      'Successfully rendered PDF viewer',
    )

    // Return HTML with proper headers
    return new NextResponse(html, {
      status: 200,
      headers: RESPONSE_HEADERS,
    })
  } catch (error) {
    reqLogger.error({ error }, 'Unexpected error proxying PDF viewer')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
