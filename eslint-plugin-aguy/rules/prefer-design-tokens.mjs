/**
 * ESLint Rule: prefer-design-tokens
 *
 * Suggests using design tokens instead of raw Tailwind values.
 *
 * @example
 * // ❌ BAD - Raw Tailwind values
 * className="text-xl py-8 gap-4 shadow-lg"
 *
 * // ✅ GOOD - Design tokens
 * className="text-heading-xl py-section-md gap-content-gap shadow-card"
 */

const DESIGN_TOKEN_SUGGESTIONS = {
  // Typography replacements
  'text-xs': 'text-body-xs',
  'text-sm': 'text-body-sm',
  'text-base': 'text-body-md',
  'text-lg': 'text-body-lg',
  'text-xl': 'text-heading-xl or text-heading-lg',
  'text-2xl': 'text-heading-xl',
  'text-3xl': 'text-heading-xl or display-sm',
  'text-4xl': 'display-md or text-heading-xl',
  'text-5xl': 'display-lg',
  'text-6xl': 'display-xl',

  // Spacing replacements
  'p-4': 'p-card-padding or p-card-padding-sm',
  'p-6': 'p-card-padding',
  'p-8': 'p-card-padding-lg',
  'py-4': 'py-section-xs or py-content-gap',
  'py-6': 'py-section-sm',
  'py-8': 'py-section-md',
  'py-12': 'py-section-md or py-section-lg',
  'py-16': 'py-section-lg',
  'py-24': 'py-section-xl',

  // Gap replacements
  'gap-4': 'gap-content-gap',
  'gap-6': 'gap-content-gap-lg',
  'gap-8': 'gap-content-gap-xl',

  // Shadow replacements
  'shadow-sm': 'shadow-elevation-1',
  'shadow-md': 'shadow-elevation-2 or shadow-card',
  'shadow-lg': 'shadow-elevation-3 or shadow-card',
  'shadow-xl': 'shadow-elevation-4 or shadow-card-hover or shadow-modal',

  // Duration replacements
  'duration-100': 'duration-fast',
  'duration-150': 'duration-fast',
  'duration-200': 'duration-normal',
  'duration-300': 'duration-slow',
  'duration-500': 'duration-slower',

  // Border radius for chat (common patterns)
  'rounded-[20px]': 'rounded-chat-lg or rounded-chat-xl',
  'rounded-[30px]': 'rounded-chat-2xl',
  'rounded-[12px]': 'rounded-chat-sm',
  'rounded-[16px]': 'rounded-chat-md',
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Suggest using design tokens instead of raw Tailwind values',
      category: 'Best Practices',
      recommended: false,
    },
    messages: {
      preferToken:
        'Consider using design token "{{ token }}" instead of "{{ raw }}". {{ suggestion }}',
    },
    schema: [
      {
        type: 'object',
        properties: {
          // Allow disabling certain suggestions
          disabledSuggestions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    ],
  },

  create(context) {
    const filename = context.getFilename()
    const options = context.options[0] || {}
    const disabledSuggestions = options.disabledSuggestions || []

    // Only check UI component files
    if (!filename.includes('/ui/') && !filename.includes('/app/')) {
      return {}
    }

    // Check for raw className values in JSX
    const checkClassName = (node, classNameValue) => {
      if (!classNameValue || typeof classNameValue !== 'string') return

      const classes = classNameValue.split(/\s+/)

      for (const cls of classes) {
        // Skip if suggestion is disabled
        if (disabledSuggestions.includes(cls)) continue

        // Skip dynamic classes and CSS variables
        if (cls.includes('[data-') || cls.includes(':')) continue

        // Check for exact matches first
        if (DESIGN_TOKEN_SUGGESTIONS[cls]) {
          const suggestion = DESIGN_TOKEN_SUGGESTIONS[cls]
          context.report({
            node,
            messageId: 'preferToken',
            data: {
              token: cls,
              raw: cls,
              suggestion: suggestion,
            },
          })
        }

        // Check for partial matches (e.g., rounded-[20px])
        for (const [pattern, replacement] of Object.entries(DESIGN_TOKEN_SUGGESTIONS)) {
          if (pattern.includes('[') && cls.startsWith(pattern.split('[')[0])) {
            context.report({
              node,
              messageId: 'preferToken',
              data: {
                token: cls,
                raw: cls,
                suggestion: replacement,
              },
            })
          }
        }
      }
    }

    return {
      JSXAttribute(node) {
        // Check className attributes
        if (node.name.name === 'className' || node.name.name === 'class') {
          if (node.value && node.value.type === 'JSXExpressionContainer') {
            const expr = node.value.expression
            if (expr && expr.type === 'Literal' && typeof expr.value === 'string') {
              checkClassName(node, expr.value)
            } else if (expr && expr.type === 'TemplateLiteral') {
              // Handle template literals like `text-${size}
              // These are harder to analyze statically, skip for now
            }
          } else if (
            node.value &&
            node.value.type === 'Literal' &&
            typeof node.value.value === 'string'
          ) {
            checkClassName(node, node.value.value)
          }
        }
      },
    }
  },
}

export default rule
