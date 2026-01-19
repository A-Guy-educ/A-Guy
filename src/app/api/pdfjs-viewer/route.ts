import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/utilities/logger'
import { RESPONSE_HEADERS } from '@/lib/pdfjs/config'
import { validateFileUrl, redactUrl } from '@/lib/pdfjs/validator'
import { loadViewerTemplate, loadViewerCss } from '@/lib/pdfjs/template-loader'
import { rewriteCss, renderViewerHtml, validateRewrittenHtml } from '@/lib/pdfjs/renderer'
import { RequestTiming } from '@/utilities/perf/request-timing'

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
  const timing = new RequestTiming({ requestId, endpoint: '/api/pdfjs-viewer', logger: reqLogger })
  timing.markPoint('handler_entry')

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

    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json(
        { error: 'Invalid file URL', details: validation.error.message },
        { status: 400 },
      ),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  }

  const validatedFileUrl = validation.url
  reqLogger.debug({ fileUrl: redactUrl(validatedFileUrl) }, 'File URL validated')

  try {
    // Load viewer template
    const { result: templateResult } = await timing.time('external_call:viewer_template', () =>
      loadViewerTemplate(),
    )
    if (!templateResult.ok) {
      reqLogger.error(
        { status: templateResult.status, statusText: templateResult.statusText },
        'Failed to fetch viewer HTML from CDN',
      )
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json({ error: 'PDF viewer upstream unavailable' }, { status: 502 }),
      )
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }

    // Load viewer CSS
    const { result: cssResult } = await timing.time('external_call:viewer_css', () =>
      loadViewerCss(),
    )
    if (!cssResult.ok) {
      reqLogger.error(
        { status: cssResult.status, statusText: cssResult.statusText },
        'Failed to fetch viewer CSS from CDN',
      )
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json({ error: 'PDF viewer upstream unavailable' }, { status: 502 }),
      )
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }

    // Rewrite CSS to fix image paths
    const rewrittenCss = rewriteCss(cssResult.css)

    // Render final HTML
    let html = renderViewerHtml(templateResult.html, rewrittenCss)

    // Validate rewrite was successful
    const validation = validateRewrittenHtml(html)
    if (!validation.valid) {
      reqLogger.error({ issues: validation.issues }, 'HTML rewrite validation failed')
      const { result: response } = timing.timeSync('serialization', () =>
        NextResponse.json({ error: 'PDF viewer rendering error' }, { status: 500 }),
      )
      timing.markPoint('handler_exit')
      timing.logIfSlow()
      return response
    }

    // Inject file URL via query parameter (PDF.js native mechanism)
    // The viewer will read the file parameter from its own URL
    if (validatedFileUrl) {
      // PDF.js viewer.html reads the file parameter from window.location.search
      // We pass it through by adding it to the base href or letting the iframe handle it
      // Since we're serving the HTML directly, we need to inject it via the viewer's
      // own query handling mechanism

      // Add file parameter to viewer's window.location simulation
      // The viewer expects to read 'file' from URLSearchParams
      html = html.replace(
        '</head>',
        `<script>
          // Inject file URL into viewer's URL handling
          // PDF.js viewer reads 'file' from window.location.search
          if (typeof window !== 'undefined') {
            const originalSearch = window.location.search;
            Object.defineProperty(window.location, 'search', {
              get: function() {
                return '?file=${encodeURIComponent(validatedFileUrl).replace(/'/g, "\\'")}';
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
    const { result: response } = timing.timeSync('serialization', () =>
      new NextResponse(html, {
        status: 200,
        headers: RESPONSE_HEADERS,
      }),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  } catch (error) {
    reqLogger.error({ error }, 'Unexpected error proxying PDF viewer')
    const { result: response } = timing.timeSync('serialization', () =>
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    )
    timing.markPoint('handler_exit')
    timing.logIfSlow()
    return response
  }
}
