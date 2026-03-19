import type { Block } from 'payload'

import { validateHtml } from './validate-html'

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
          'Enter HTML content. Links must be relative (/path or #anchor). Allowed attributes: class, id, data-* on all tags; href (required), title, class, id, data-* on <a> tags; colspan, rowspan, scope on table cells; plus safe SVG attributes (e.g., viewBox, fill, stroke, d). No style=, target=, or on*= attributes allowed. The <style> tag is allowed.',
        language: 'html',
        components: {
          Field: '@/ui/admin/QuillField#QuillField',
        },
      },
      validate: validateHtml,
    },
  ],
}
