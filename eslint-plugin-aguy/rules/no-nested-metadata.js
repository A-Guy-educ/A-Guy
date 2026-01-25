/**
 * ESLint Rule: no-nested-metadata
 *
 * Prevents nested objects in Payload collection fields.
 * Payload does not support deeply nested metadata.
 *
 * @example
 * // ❌ BAD - Nested group with JSON field
 * {
 *   name: 'user',
 *   type: 'group',
 *   fields: [
 *     { name: 'profile', type: 'json' } // Nested metadata not supported
 *   ]
 * }
 *
 * // ✅ GOOD - Flat structure
 * {
 *   name: 'userName',
 *   type: 'text'
 * }
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent nested objects in Payload fields (not supported)',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      nestedMetadata:
        'Nested metadata is not supported in Payload. Use flat field structure instead.',
    },
    schema: [],
  },

  create(context) {
    return {
      Property(node) {
        // Check if this is a field definition with type 'group' containing 'json' fields
        if (node.key && node.key.name === 'type' && node.value && node.value.value === 'group') {
          // Look for parent object to find fields array
          const parent = node.parent
          if (parent && parent.type === 'ObjectExpression') {
            const fieldsProperty = parent.properties.find(
              (prop) => prop.key && prop.key.name === 'fields',
            )

            if (
              fieldsProperty &&
              fieldsProperty.value &&
              fieldsProperty.value.type === 'ArrayExpression'
            ) {
              // Check if any child field is type 'json'
              const hasJsonField = fieldsProperty.value.elements.some((element) => {
                if (element && element.type === 'ObjectExpression') {
                  return element.properties.some(
                    (prop) =>
                      prop.key &&
                      prop.key.name === 'type' &&
                      prop.value &&
                      prop.value.value === 'json',
                  )
                }
                return false
              })

              if (hasJsonField) {
                context.report({
                  node: parent,
                  messageId: 'nestedMetadata',
                })
              }
            }
          }
        }
      },
    }
  },
}
