import type { Block } from 'payload'

export const HtmlBlock: Block = {
  slug: 'html',
  interfaceName: 'HtmlBlock',
  labels: {
    plural: 'HTML Blocks',
    singular: 'HTML Block',
  },
  fields: [
    {
      name: 'html',
      type: 'code',
      required: true,
      admin: {
        description:
          'Enter HTML content. Links must be relative (/path or #anchor). Allowed attributes: class, id, data-* on all tags; href (required), title, class, id, data-* on <a> tags; plus safe SVG attributes (e.g., viewBox, fill, stroke, d). No style=, target=, or on*= attributes allowed. The <style> tag is allowed.',
        language: 'html',
        components: {
          Field: '@/ui/admin/HtmlBlock/Field',
        },
      },
      validate: (value: string | null | undefined): string | true => {
        if (!value || typeof value !== 'string') {
          return 'HTML content is required'
        }

        const trimmed = value.trim()
        if (!trimmed) {
          return 'HTML content is required'
        }

        // Block dangerous tags (style tag is now allowed)
        const dangerousTags = [
          '<script',
          '<iframe',
          '<object',
          '<embed',
          '<applet',
          '<meta',
          '<base',
          '<link',
          '<title',
        ]

        for (const tag of dangerousTags) {
          const lowerTag = tag.toLowerCase()
          if (trimmed.toLowerCase().includes(lowerTag)) {
            if (tag === '<title') {
              return '<title> is not allowed in HtmlBlock. Put title in the page head.'
            }
            return `HTML contains blocked content: ${tag}`
          }
        }

        // Check for foreignObject in SVG
        const foreignObjectPattern =
          /<svg[^>]*>[\s\S]*?<foreignObject[\s\S]*?<\/foreignObject[\s\S]*?<\/svg>/gi
        if (foreignObjectPattern.test(trimmed)) {
          return 'foreignObject is not allowed in SVG'
        }

        // Block inline event handlers (onclick, onload, etc.)
        const eventHandlerPattern = /\bon\w+\s*=/gi
        const eventMatch = eventHandlerPattern.exec(trimmed)
        if (eventMatch) {
          return `inline event handlers are not allowed: ${eventMatch[0]}`
        }

        // Block javascript: URLs
        const jsUrlPattern = /href\s*=\s*["']?\s*javascript:/gi
        const jsMatch = jsUrlPattern.exec(trimmed)
        if (jsMatch) {
          return `javascript: URLs are not allowed: ${jsMatch[0]}`
        }

        // Block data: URLs in href
        const dataHrefPattern = /href\s*=\s*["']?\s*data:/gi
        const dataHrefMatch = dataHrefPattern.exec(trimmed)
        if (dataHrefMatch) {
          return `data: URLs are not allowed in href: ${dataHrefMatch[0]}`
        }

        // Block data: URLs in src
        const dataUrlPattern = /src\s*=\s*["']?\s*data:/gi
        const dataSrcMatch = dataUrlPattern.exec(trimmed)
        if (dataSrcMatch) {
          return `data: URLs are not allowed: ${dataSrcMatch[0]}`
        }

        // Block protocol-relative URLs (//)
        const protocolRelativeHrefPattern = /href\s*=\s*["']?\s*\/\//gi
        const protocolRelativeMatch = protocolRelativeHrefPattern.exec(trimmed)
        if (protocolRelativeMatch) {
          return `Protocol-relative URLs (//) are not allowed: ${protocolRelativeMatch[0]}`
        }

        // Block external URLs (http://, https://) in href - CHECK BEFORE GENERAL / or # CHECK
        const externalHrefPattern = /href\s*=\s*["']?\s*https?:\/\//gi
        const externalMatch = externalHrefPattern.exec(trimmed)
        if (externalMatch) {
          return `href must start with / or #: ${externalMatch[0]}`
        }

        // Block mailto: URLs - CHECK BEFORE GENERAL / or # CHECK
        const mailtoPattern = /href\s*=\s*["']?\s*mailto:/gi
        const mailtoMatch = mailtoPattern.exec(trimmed)
        if (mailtoMatch) {
          return `mailto: links are not allowed: ${mailtoMatch[0]}`
        }

        // Block tel: URLs - CHECK BEFORE GENERAL / or # CHECK
        const telPattern = /href\s*=\s*["']?\s*tel:/gi
        const telMatch = telPattern.exec(trimmed)
        if (telMatch) {
          return `tel: links are not allowed: ${telMatch[0]}`
        }

        // Block ftp: URLs - CHECK BEFORE GENERAL / or # CHECK
        const ftpPattern = /href\s*=\s*["']?\s*ftp:/gi
        const ftpMatch = ftpPattern.exec(trimmed)
        if (ftpMatch) {
          return `ftp: links are not allowed: ${ftpMatch[0]}`
        }

        // Allowlist: Only permit safe tags (style tag is allowed)
        const allowedTags = [
          // Core content/layout
          'div',
          'span',
          'p',
          'br',
          'hr',
          // Headings
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          // Text formatting
          'strong',
          'b',
          'em',
          'i',
          'u',
          's',
          'del',
          'ins',
          // Lists
          'ul',
          'ol',
          'li',
          // Links
          'a',
          // Code/quote
          'blockquote',
          'pre',
          'code',
          // Style
          'style',
          // Semantic HTML5
          'header',
          'main',
          'footer',
          'section',
          'nav',
          'article',
          'aside',
          // Interactions
          'button',
          // SVG
          'svg',
          'path',
          'circle',
          'rect',
          'line',
          'polyline',
          'polygon',
          'g',
          'defs',
          'lineargradient',
          'radialgradient',
          'stop',
          'use',
        ]

        const tagCheckPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
        let tagCheckMatch
        while ((tagCheckMatch = tagCheckPattern.exec(trimmed)) !== null) {
          const tagName = tagCheckMatch[1].toLowerCase()
          if (!allowedTags.includes(tagName)) {
            return `HTML contains disallowed tag: <${tagName}>`
          }
        }

        // SVG-specific tags (path, circle, rect, line, polyline, polygon, g, defs, gradient, stop)
        const svgGeometryTags = [
          'path',
          'circle',
          'rect',
          'line',
          'polyline',
          'polygon',
          'g',
          'defs',
          'lineargradient',
          'radialgradient',
          'stop',
          'use',
        ]

        // Safe SVG attributes (case-insensitive check)
        const svgAttrs = [
          'd',
          'viewbox',
          'xmlns',
          'fill',
          'stroke',
          'stroke-width',
          'stroke-linecap',
          'stroke-linejoin',
          'width',
          'height',
          'cx',
          'cy',
          'r',
          'x',
          'y',
          'rx',
          'ry',
          'points',
          'aria-hidden',
          'role',
          'focusable',
          'offset',
          'stop-color',
          'stop-opacity',
          'gradientunits',
          'gradienttransform',
          'x1',
          'x2',
          'y1',
          'y2',
          'fx',
          'fy',
          'fr',
          'spreadmethod',
          'href',
          'xlink:href',
          'clip-rule',
          'fill-rule',
          'stroke-opacity',
        ]

        // Attribute validation function
        const isAllowedAttribute = (
          attrName: string,
          tagName: string,
        ): { allowed: boolean; message?: string } => {
          const lowerAttr = attrName.toLowerCase()

          // Global attributes allowed on ALL tags
          if (lowerAttr === 'class') return { allowed: true }
          if (lowerAttr === 'id') return { allowed: true }
          if (lowerAttr.startsWith('data-')) return { allowed: true }

          // Forbidden attributes everywhere
          if (lowerAttr === 'style')
            return { allowed: false, message: 'style attributes are not allowed: style=' }
          if (lowerAttr === 'target')
            return { allowed: false, message: 'target attributes are not allowed: target=' }
          if (attrName.toLowerCase().startsWith('on')) {
            // Find the original case version in the source
            const originalAttrMatch = new RegExp(`${attrName}\\s*=`, 'i').exec(trimmed)
            const originalAttr = originalAttrMatch ? originalAttrMatch[0] : `on*`
            return {
              allowed: false,
              message: `inline event handlers are not allowed: ${originalAttr}`,
            }
          }

          // SVG-specific attributes (block href/xlink:href on SVG for now)
          if (tagName === 'svg') {
            // Block href and xlink:href on SVG elements entirely (same relative-only policy as <a>)
            if (lowerAttr === 'href' || lowerAttr === 'xlink:href') {
              return {
                allowed: false,
                message: 'href attributes on SVG elements are not allowed. Use <a> tags for links.',
              }
            }
            if (svgAttrs.includes(lowerAttr)) {
              return { allowed: true }
            }
          }

          // SVG gradient-specific attributes
          if (['lineargradient', 'radialgradient'].includes(tagName)) {
            // Block href/xlink:href on gradient elements
            if (lowerAttr === 'href' || lowerAttr === 'xlink:href') {
              return {
                allowed: false,
                message: 'href attributes on SVG elements are not allowed. Use <a> tags for links.',
              }
            }
            if (svgAttrs.includes(lowerAttr)) {
              return { allowed: true }
            }
          }

          // SVG stop element attributes
          if (tagName === 'stop') {
            if (svgAttrs.includes(lowerAttr)) {
              return { allowed: true }
            }
          }

          // SVG use element attributes
          if (tagName === 'use') {
            // Block href/xlink:href on use elements
            if (lowerAttr === 'href' || lowerAttr === 'xlink:href') {
              return {
                allowed: false,
                message: 'href attributes on SVG elements are not allowed. Use <a> tags for links.',
              }
            }
            if (svgAttrs.includes(lowerAttr)) {
              return { allowed: true }
            }
          }

          // SVG geometry attributes on SVG child elements
          if (svgGeometryTags.includes(tagName)) {
            if (svgAttrs.includes(lowerAttr)) {
              return { allowed: true }
            }
          }

          // <a> tag specific attributes
          if (tagName === 'a') {
            if (lowerAttr === 'href') return { allowed: true }
            if (lowerAttr === 'title') return { allowed: true }
            // class, id, data-* already handled as global
          }

          // If not allowed, return false
          return {
            allowed: false,
            message: `attribute "${attrName}" is not allowed on <${tagName}>`,
          }
        }

        // For anchor tags, validate href value and allowed attributes
        const anchorTagPattern = /<a\b([^>]*)>/gi
        let anchorMatch
        while ((anchorMatch = anchorTagPattern.exec(trimmed)) !== null) {
          const attrs = anchorMatch[1]

          // Check for href attribute presence
          const hrefAttrPattern = /href\s*=\s*["']?([^"'\s>]+)["']?/gi
          const hrefAttrMatch = hrefAttrPattern.exec(attrs)
          if (!hrefAttrMatch) {
            return 'href attribute is required on <a> tags'
          }

          const hrefValue = hrefAttrMatch[1]

          // Must start with / or #, and not be empty
          if (!hrefValue || hrefValue.length === 0) {
            return 'href attribute cannot be empty'
          }

          const firstChar = hrefValue.charAt(0)
          if (firstChar !== '/' && firstChar !== '#') {
            return `href must start with / or #: href="${hrefValue}"`
          }

          // Check all attributes on <a> tag
          const allAttrPattern = /\b([a-zA-Z][a-zA-Z0-9-]*)\s*=/gi
          let attrMatch
          while ((attrMatch = allAttrPattern.exec(attrs)) !== null) {
            const attrName = attrMatch[1]
            const result = isAllowedAttribute(attrName, 'a')
            if (!result.allowed) {
              return result.message ?? `attribute "${attrName}" is not allowed on <a>`
            }
          }
        }

        // Validate attributes on all other tags
        const generalTagPattern = /<(?!a\b)([a-z][a-z0-9]*)\b([^>]*)>/gi
        let tagMatch
        while ((tagMatch = generalTagPattern.exec(trimmed)) !== null) {
          const tagName = tagMatch[1].toLowerCase()
          const tagAttrs = tagMatch[2]

          // Check all attributes on the tag
          const allAttrPattern = /\b([a-zA-Z][a-zA-Z0-9-]*)\s*=/gi
          let attrMatch
          while ((attrMatch = allAttrPattern.exec(tagAttrs)) !== null) {
            const attrName = attrMatch[1]
            const result = isAllowedAttribute(attrName, tagName)
            if (!result.allowed) {
              return result.message ?? `attribute "${attrName}" is not allowed on <${tagName}>`
            }
          }
        }

        return true
      },
    },
  ],
}
