/**
 * Shared DOMPurify configuration for rendering user-authored HTML content.
 *
 * This whitelist is intentionally broad to support rich authoring (gradients,
 * shadows, flex/grid layouts, interactive disclosures, dialogs, and action
 * buttons) while still blocking XSS vectors. Specifically:
 *
 * - `script`, `iframe`, `object`, `embed`, `form`, and event handler
 *   attributes (`on*`) are NOT allowed.
 * - `style` is permitted but DOMPurify's built-in CSS parser strips
 *   `expression(...)`, `javascript:` URLs, and other dangerous values.
 * - `href`/`src` values are run through DOMPurify's URL sanitizer
 *   (no `javascript:` URIs).
 */
export const SAFE_HTML_PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    // Text / structure
    'p',
    'br',
    'hr',
    'span',
    'div',
    'section',
    'article',
    'header',
    'footer',
    'main',
    'aside',
    'nav',
    'figure',
    'figcaption',
    // Headings
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    // Inline formatting
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'ins',
    'mark',
    'sub',
    'sup',
    'small',
    'abbr',
    'cite',
    'q',
    // Lists
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    // Quotes / code
    'blockquote',
    'pre',
    'code',
    'kbd',
    'samp',
    // Media
    'a',
    'img',
    // Tables
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
    // Interactive disclosure / dialog
    'details',
    'summary',
    'dialog',
    // Action buttons (no <form>/<input> — button is stand-alone)
    'button',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'class',
    'id',
    'target',
    'rel',
    'width',
    'height',
    'colspan',
    'rowspan',
    'dir',
    'lang',
    'role',
    // CSS whitelist (DOMPurify still filters the value against its CSS parser)
    'style',
    // Interactive element state
    'open',
    // <button> needs explicit type to avoid implicit submit; `disabled` for styling
    'type',
    'disabled',
  ],
  // Allow `data-*` and `aria-*` attributes for action wiring + accessibility.
  ALLOW_DATA_ATTR: true,
  ALLOW_ARIA_ATTR: true,
  // Keep content inside elements that get stripped (defensive default).
  KEEP_CONTENT: true,
  // Never allow MathML/SVG here — exercises use dedicated SVG/Latex blocks.
  USE_PROFILES: { html: true },
}
