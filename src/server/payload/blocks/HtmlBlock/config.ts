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
      type: 'textarea',
      required: true,
      admin: {
        description: 'Enter HTML content. Links must be relative (/path or #anchor).',
        rows: 10,
      },
      validate: (value: string | null | undefined): string | true => {
        if (!value || typeof value !== 'string') {
          return 'HTML content is required'
        }

        const trimmed = value.trim()
        if (!trimmed) {
          return 'HTML content is required'
        }

        // Block dangerous tags
        const dangerousTags = [
          '<script',
          '<iframe',
          '<object',
          '<embed',
          '<applet',
          '<meta',
          '<base',
          '<link',
          '<style',
        ]

        for (const tag of dangerousTags) {
          const lowerTag = tag.toLowerCase()
          if (trimmed.toLowerCase().includes(lowerTag)) {
            return `HTML contains blocked content: ${tag}`
          }
        }

        // Block inline event handlers
        const eventHandlerPattern = /\bon\w+\s*=/gi
        if (eventHandlerPattern.test(trimmed)) {
          return 'Inline event handlers (onclick, onload, etc.) are not allowed'
        }

        // Block javascript: URLs
        const jsUrlPattern = /href\s*=\s*["']?\s*javascript:/gi
        if (jsUrlPattern.test(trimmed)) {
          return 'javascript: URLs are not allowed'
        }

        // Block external URLs in href/src
        const externalUrlPattern = /href\s*=\s*["']\s*(https?:)?\/\//gi
        const srcUrlPattern = /src\s*=\s*["']\s*(https?:)?\/\//gi

        if (externalUrlPattern.test(trimmed)) {
          return 'External URLs (http://, https://, //) are not allowed in href. Use relative paths (/path) or anchors (#anchor).'
        }

        if (srcUrlPattern.test(trimmed)) {
          return 'External URLs (http://, https://, //) are not allowed in src attributes.'
        }

        // Block data: URLs
        const dataUrlPattern = /src\s*=\s*["']?\s*data:/gi
        if (dataUrlPattern.test(trimmed)) {
          return 'data: URLs are not allowed'
        }

        // Allowlist: Only permit safe tags
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
        ]

        const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
        let match
        while ((match = tagPattern.exec(trimmed)) !== null) {
          const tagName = match[1].toLowerCase()
          if (!allowedTags.includes(tagName)) {
            return `HTML contains disallowed tag: <${tagName}>`
          }
        }

        return true
      },
    },
  ],
}
