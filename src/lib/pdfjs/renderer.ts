import { CDN_BASE, VIEWER_URLS } from './config'
import { logger } from '@/utilities/logger'

/**
 * Rewrite CSS to fix relative image paths
 * Converts url(images/...) to absolute CDN URLs
 */
export function rewriteCss(css: string): string {
  return css.replace(/url\(images\//g, `url(${CDN_BASE}/web/images/`)
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
 *
 * Security features:
 * - Hides download and print buttons via CSS
 * - Disables Ctrl+P/Cmd+P keyboard shortcuts
 * - Overrides window.print() to prevent programmatic printing
 * - Disables context menu to prevent right-click print
 *
 * @param html - Original viewer HTML
 * @param css - CSS content (should already have image paths rewritten via rewriteCss)
 * @param options - Optional configuration
 * @param options.annotationEditorMode - PDF.js annotation editor mode (0=none, 15=highlight, etc)
 */
export function renderViewerHtml(
  html: string,
  css: string,
  options?: { annotationEditorMode?: number },
): string {
  logger.debug('Starting HTML rewrite pipeline')

  let result = html

  // Step 1: Add base href right after <head>
  result = result.replace('<head>', `<head>\n  <base href="${CDN_BASE}/web/">`)

  // Step 2: Replace viewer.mjs with CDN URL
  result = result.replace('src="viewer.mjs"', `src="${VIEWER_URLS.mjs}"`)

  // Step 3: Replace pdf.mjs references
  // - Relative path from prebuilt version
  result = result.replace('src="../build/pdf.mjs"', `src="${VIEWER_URLS.pdfMjs}"`)
  // - Mozilla CDN reference
  result = result.replace(
    'src="https://mozilla.github.io/pdf.js/build/pdf.mjs"',
    `src="${VIEWER_URLS.pdfMjs}"`,
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
    `<style>${css}</style>\n<style>
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
        ${
          options?.annotationEditorMode !== undefined
            ? `
        // Enable annotation editor mode
        document.addEventListener('DOMContentLoaded', function() {
          if (window.PDFViewerApplication) {
            window.PDFViewerApplication.initializedPromise.then(function() {
              window.PDFViewerApplication.eventBus.dispatch('switchannotationeditormode', {
                mode: ${options.annotationEditorMode}
              });
            });
          }
        });
        `
            : ''
        }
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
export function validateRewrittenHtml(html: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check that viewer.mjs was replaced
  if (html.includes('src="viewer.mjs"') && !html.includes(`src="${VIEWER_URLS.mjs}"`)) {
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
  if (!html.includes(`<base href="${CDN_BASE}/web/">`)) {
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
