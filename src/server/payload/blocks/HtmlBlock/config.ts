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
          'Enter HTML content. Links must be relative (/path or #anchor). Allowed attributes: class, data-* on all tags; href (required), title, class, data-* on <a> tags. No style=, target=, or on*= attributes allowed. The <style> tag is allowed.',
        language: 'html',
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
        ]

        for (const tag of dangerousTags) {
          const lowerTag = tag.toLowerCase()
          if (trimmed.toLowerCase().includes(lowerTag)) {
            return `HTML contains blocked content: ${tag}`
          }
        }

        // Block inline event handlers (onclick, onload, etc.)
        const eventHandlerPattern = /\bon\w+\s*=/gi
        const eventMatch = eventHandlerPattern.exec(trimmed)
        if (eventMatch) {
          return `Inline event handlers are not allowed: ${eventMatch[0]}`
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
          return `External URLs are not allowed, use relative paths (/path) or anchors (#anchor): ${externalMatch[0]}`
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

        // For anchor tags, validate href value and allowed attributes
        const anchorTagPattern = /<a\b([^>]*)>/gi
        let anchorMatch
        while ((anchorMatch = anchorTagPattern.exec(trimmed)) !== null) {
          const attrs = anchorMatch[1]

          // Extract href value from anchor attributes
          const hrefAttrPattern = /href\s*=\s*["']?([^"'\s>]+)["']?/gi
          const hrefAttrMatch = hrefAttrPattern.exec(attrs)
          if (hrefAttrMatch) {
            const hrefValue = hrefAttrMatch[1]

            // Must start with / or #, and not be empty
            if (!hrefValue || hrefValue.length === 0) {
              return 'href attribute cannot be empty'
            }

            const firstChar = hrefValue.charAt(0)
            if (firstChar !== '/' && firstChar !== '#') {
              return `href must start with / or #, found: href="${hrefValue}"`
            }
          }

          // Check for any disallowed attributes on <a> tags
          // Allowed: href (required), title (optional), class (optional), data-* (optional)
          const allAttrPattern = /\b([a-z-]+)\s*=/gi
          let attrMatch
          while ((attrMatch = allAttrPattern.exec(attrs)) !== null) {
            const attrName = attrMatch[1].toLowerCase()

            // href is required, so only check non-href attributes
            if (attrName === 'href') continue

            // title is allowed
            if (attrName === 'title') continue

            // class is allowed
            if (attrName === 'class') continue

            // data-* attributes are allowed
            if (attrName.startsWith('data-')) continue

            // Any other attribute is forbidden
            return `<a> tag does not allow attribute "${attrName}"`
          }
        }

        // Allow class and data-* attributes on non-<a> tags
        // Block all other attributes
        const nonAnchorTagPattern = /<(?!a\b)([a-z][a-z0-9]*)\b([^>]*)>/gi
        let tagMatch
        while ((tagMatch = nonAnchorTagPattern.exec(trimmed)) !== null) {
          const tagName = tagMatch[1].toLowerCase()
          const tagAttrs = tagMatch[2]

          // Check if this tag has any attribute assignment
          // Attribute pattern: word followed by = (with optional whitespace)
          const hasAttributePattern = /\b([a-z-]+)\s*=/gi
          let attrCheck
          while ((attrCheck = hasAttributePattern.exec(tagAttrs)) !== null) {
            const attrName = attrCheck[1].toLowerCase()

            // class is allowed
            if (attrName === 'class') continue

            // data-* attributes are allowed
            if (attrName.startsWith('data-')) continue

            // Any other attribute is forbidden
            return `Attribute "${attrName}" is not allowed on <${tagName}> tags`
          }
        }

        // Allowlist: Only permit safe tags (style tag is allowed)
        const allowedTags = [
          'p',
          'br',
          'hr',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'strong',
          'b',
          'em',
          'i',
          'u',
          's',
          'del',
          'ins',
          'ul',
          'ol',
          'li',
          'a',
          'blockquote',
          'code',
          'pre',
          'span',
          'div',
          'style',
        ]

        const tagCheckPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
        let tagCheckMatch
        while ((tagCheckMatch = tagCheckPattern.exec(trimmed)) !== null) {
          const tagName = tagCheckMatch[1].toLowerCase()
          if (!allowedTags.includes(tagName)) {
            return `HTML contains disallowed tag: <${tagName}>`
          }
        }

        return true
      },
    },
  ],
}
