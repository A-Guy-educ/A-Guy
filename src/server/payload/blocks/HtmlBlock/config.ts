import type { Block } from 'payload'

import { validateHtmlContent } from '@/server/payload/fields/htmlValidation'

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
      validate: validateHtmlContent,
    },
  ],
}
