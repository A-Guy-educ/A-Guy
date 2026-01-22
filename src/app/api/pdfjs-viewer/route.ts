import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/utilities/logger'
import { RESPONSE_HEADERS } from '@/lib/pdfjs/config'
import { validateFileUrl, redactUrl } from '@/lib/pdfjs/validator'
import { loadViewerTemplate, loadViewerCss } from '@/lib/pdfjs/template-loader'
import { rewriteCss, renderViewerHtml, validateRewrittenHtml } from '@/lib/pdfjs/renderer'

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

  // Parse annotation editor mode parameter (for enabling highlight/drawing features)
  const annotationEditorModeParam = request.nextUrl.searchParams.get('annotationEditorMode')

  reqLogger.debug(
    {
      fileParam: fileParam ? redactUrl(fileParam) : null,
      annotationEditorMode: annotationEditorModeParam,
    },
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
    let html = renderViewerHtml(templateResult.html, rewrittenCss)

    // Validate rewrite was successful
    const validation = validateRewrittenHtml(html)
    if (!validation.valid) {
      reqLogger.error({ issues: validation.issues }, 'HTML rewrite validation failed')
      return NextResponse.json({ error: 'PDF viewer rendering error' }, { status: 500 })
    }

    // Inject file URL and annotation editor mode via query parameter (PDF.js native mechanism)
    // The viewer will read parameters from its own URL
    if (validatedFileUrl) {
      // PDF.js viewer.html reads parameters from window.location.search
      // Build query string with file and optional annotationEditorMode
      const queryParams = new URLSearchParams()
      queryParams.set('file', validatedFileUrl)

      // Add annotation editor mode if specified
      // This enables highlight/drawing features in PDF.js viewer
      if (annotationEditorModeParam) {
        queryParams.set('annotationEditorMode', annotationEditorModeParam)
      }

      const queryString = queryParams.toString()

      html = html.replace(
        '</head>',
        `<script>
          // Inject parameters into viewer's URL handling
          // PDF.js viewer reads parameters from window.location.search
          if (typeof window !== 'undefined') {
            Object.defineProperty(window.location, 'search', {
              get: function() {
                return '?${queryString.replace(/'/g, "\\'")}';
              }
            });
          }
        </script>
        </head>`,
      )
    }

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
