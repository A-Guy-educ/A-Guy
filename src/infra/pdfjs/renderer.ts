import { logger } from '@/infra/utils/logger'
import { CDN_BASE, VIEWER_URLS, type ViewerUrls } from './config'

/**
 * Rewrite CSS to fix relative image paths
 * Converts url(images/...) to absolute CDN URLs
 */
export function rewriteCss(css: string, cdnBase?: string): string {
  const base = cdnBase || CDN_BASE
  return css.replace(/url\(images\//g, `url(${base}/web/images/`)
}

/**
 * Apply deterministic HTML rewrite pipeline
 *
 * Order of operations:
 * 1. Add base href for relative assets
 * 2. Replace viewer asset references (mjs, css)
 * 3. Replace pdf.mjs references
 * 4. Remove broken locale references
 * 5. Inline rewritten CSS
 * 6. Inject security features to disable download and print
 * 7. Inject PDF.js configuration to disable range requests
 *
 * Security features:
 * - Hides download and print buttons via CSS
 * - Disables Ctrl+P/Cmd+P keyboard shortcuts
 * - Overrides window.print() to prevent programmatic printing
 * - Disables context menu to prevent right-click print
 *
 * PDF.js configuration:
 * - Disables HTTP range requests (disableRange: true)
 * - Disables streaming mode (disableStream: true)
 * - This fixes "Invalid PDF structure" errors caused by intermittent
 *   CDN/proxy issues with partial content responses on certain platforms
 *
 * @param html - Original viewer HTML
 * @param css - CSS content (should already have image paths rewritten via rewriteCss)
 * @param cdnBase - Optional CDN base URL (will use config value if not provided)
 * @param viewerUrls - Optional viewer URLs (will use config value if not provided)
 */
export async function renderViewerHtml(
  html: string,
  css: string,
  cdnBase?: string,
  viewerUrls?: ViewerUrls,
): Promise<string> {
  const base = cdnBase || CDN_BASE
  const urls = viewerUrls || VIEWER_URLS

  logger.debug('Starting HTML rewrite pipeline')

  let result = html

  // Step 1: Add base href right after <head>
  result = result.replace('<head>', `<head>\n  <base href="${base}/web/">`)

  // Step 1.5: Inject PDF.js configuration to disable range requests
  // This MUST come before the viewer scripts load to ensure proper initialization
  // This fixes "Invalid PDF structure" errors on Chrome Windows caused by
  // intermittent CDN/proxy issues with HTTP range requests (206 Partial Content).
  // By disabling range requests, PDF.js downloads the entire file as a single request.
  //
  // IMPORTANT: We use the webviewerloaded event + PDFViewerApplicationOptions.set() API
  // because PDF.js does NOT read from window.PDFJS_GLOBAL_OPTS (that was a no-op).
  // The webviewerloaded event fires after PDFViewerApplicationOptions is initialized
  // but BEFORE the PDF document is opened, making it the correct hook for config.
  result = result.replace(
    '<head>',
    `<head>
    <script>
      // Use webviewerloaded event to configure PDF.js before document load
      // This is the correct API for the pre-built PDF.js viewer (v4.4.168+)
      document.addEventListener("webviewerloaded", function() {
        // Disable range requests to prevent intermittent partial content errors
        // on certain platforms (notably Chrome on Windows)
        PDFViewerApplicationOptions.set("disableRange", true);
        PDFViewerApplicationOptions.set("disableStream", true);
        PDFViewerApplicationOptions.set("disablePreferences", true);
        
        // Report load errors to parent frame for retry UI
        // The eventBus.on("documenterror") fires when PDF.js fails to load the document
        PDFViewerApplication.initializedPromise.then(function() {
          PDFViewerApplication.eventBus.on("documenterror", function(errorInfo) {
            console.error("PDF load error:", errorInfo);
            if (window.parent !== window) {
              window.parent.postMessage({ type: "pdf-load-error", error: errorInfo }, "*");
            }
          });
        });
      });
    </script>`,
  )

  // Step 2: Replace viewer.mjs with CDN URL
  result = result.replace('src="viewer.mjs"', `src="${urls.mjs}"`)

  // Step 3: Replace pdf.mjs references
  // - Relative path from prebuilt version
  result = result.replace('src="../build/pdf.mjs"', `src="${urls.pdfMjs}"`)
  // - Mozilla CDN reference
  result = result.replace(
    'src="https://mozilla.github.io/pdf.js/build/pdf.mjs"',
    `src="${urls.pdfMjs}"`,
  )

  // Step 4: Remove locale references that cause 404s
  result = result.replace(
    '<link rel="resource" type="application/l10n" href="https://mozilla.github.io/pdf.js/web/locale/locale.json" />',
    '',
  )
  result = result.replace(
    '<link rel="resource" type="application/l10n" href="locale/locale.json">',
    '',
  )

  // Step 5: Inline rewritten CSS
  // Note: CSS should already have image paths rewritten via rewriteCss() before calling this
  // Remove external CSS link and inject inline CSS
  result = result.replace('href="viewer.css"', 'href="data:text/css;base64,REMOVED"').replace(
    '</head>',
    `<style>${css}</style>
<style>
      /* Remove padding and fix scrolling for iframe embedding */
      body {
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      #viewerContainer {
        padding: 0 !important;
      }
      #mainContainer {
        padding: 0 !important;
      }
      /* Disable download and print controls */
      #download,
      #downloadButton,
      #openFile,
      #print,
      #printButton,
      #secondaryDownload,
      #secondaryOpenFile,
      #secondaryPrint {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    </style>
    <script>
      // Disable print keyboard shortcuts
      (function() {
        'use strict';

        // Prevent printing via keyboard shortcuts
        document.addEventListener('keydown', function(e) {
          // Check for Ctrl+P (Windows/Linux) or Cmd+P (Mac)
          if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }, true);

        // Override window.print to prevent programmatic printing
        window.print = function() {
          console.warn('Printing is disabled for this document');
          return false;
        };

        // Disable context menu to prevent right-click print
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          return false;
        }, false);
      })();
    </script>
    </head>`,
  )

  logger.debug(
    { originalSize: html.length, rewrittenSize: result.length },
    'Completed HTML rewrite',
  )

  return result
}

/**
 * Validate that HTML rewrite was successful
 * Checks that critical asset URLs were replaced
 */
export async function validateRewrittenHtml(
  html: string,
  cdnBase?: string,
  viewerUrls?: ViewerUrls,
): Promise<{ valid: boolean; issues: string[] }> {
  const base = cdnBase || CDN_BASE
  const urls = viewerUrls || VIEWER_URLS

  const issues: string[] = []

  // Check that viewer.mjs was replaced
  if (html.includes('src="viewer.mjs"') && !html.includes(`src="${urls.mjs}"`)) {
    issues.push('viewer.mjs not replaced with CDN URL')
  }

  // Check that pdf.mjs was replaced
  if (
    html.includes('src="../build/pdf.mjs"') ||
    html.includes('src="https://mozilla.github.io/pdf.js/build/pdf.mjs"')
  ) {
    issues.push('pdf.mjs references not replaced with CDN URL')
  }

  // Check that base href was added
  if (!html.includes(`<base href="${base}/web/">`)) {
    issues.push('base href not added')
  }

  // Check that CSS was inlined
  if (!html.includes('<style>') || html.includes('href="viewer.css"')) {
    issues.push('CSS not inlined correctly')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
