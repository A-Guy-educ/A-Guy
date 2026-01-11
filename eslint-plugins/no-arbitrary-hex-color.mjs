// Custom ESLint plugin to ban arbitrary hex colors in Tailwind className
// This catches patterns like bg-[#525659], text-[#...], border-[#...], etc.

const hexColorPattern = /[a-z]+-[a-z]*\[#/g

const noArbitraryHexColor = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow arbitrary hex colors in Tailwind className',
      category: 'Possible Errors',
      recommended: false,
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name === 'className' || node.name.name === 'class') {
          if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
            if (node.value.value.match(hexColorPattern) !== null) {
              context.report({
                node,
                message:
                  'Arbitrary hex colors are not allowed. Use design tokens instead (e.g., bg-surface, text-primary).',
              })
            }
          }
        }
      },
      Literal(node) {
        if (typeof node.value === 'string' && node.value.match(hexColorPattern) !== null) {
          context.report({
            node,
            message:
              'Arbitrary hex colors are not allowed. Use design tokens instead (e.g., bg-surface, text-primary).',
          })
        }
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          if (quasi.value.raw.match(hexColorPattern) !== null) {
            context.report({
              node: quasi,
              message:
                'Arbitrary hex colors are not allowed. Use design tokens instead (e.g., bg-surface, text-primary).',
            })
            break
          }
        }
      },
    }
  },
}

export default {
  rules: {
    'no-arbitrary-hex-color': noArbitraryHexColor,
  },
}
