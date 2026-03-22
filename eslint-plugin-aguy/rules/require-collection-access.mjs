/**
 * ESLint Rule: require-collection-access
 *
 * Ensures all Payload collections have access control defined.
 * This is a critical security requirement.
 *
 * @example
 * // ❌ BAD - No access control
 * export const MyCollection: CollectionConfig = {
 *   slug: 'my-collection',
 *   fields: []
 * }
 *
 * // ✅ GOOD - Access control defined
 * export const MyCollection: CollectionConfig = {
 *   slug: 'my-collection',
 *   access: {
 *     read: anyone,
 *     create: isAdmin,
 *     update: isAdmin,
 *     delete: isAdmin
 *   },
 *   fields: []
 * }
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require access control on all Payload collections',
      category: 'Security',
      recommended: true,
    },
    messages: {
      missingAccess:
        'Collection "{{name}}" is missing access control. All collections MUST define access control for read, create, update, and delete operations.',
      incompleteAccess:
        'Collection "{{name}}" has incomplete access control. Must define all CRUD operations: read, create, update, delete.',
    },
    schema: [],
  },

  create(context) {
    return {
      // Look for variable declarations that might be collections
      VariableDeclarator(node) {
        // Check if this is a CollectionConfig
        if (
          node.id &&
          node.id.typeAnnotation &&
          node.id.typeAnnotation.typeAnnotation &&
          node.id.typeAnnotation.typeAnnotation.typeName &&
          node.id.typeAnnotation.typeAnnotation.typeName.name === 'CollectionConfig'
        ) {
          const collectionName = node.id.name

          // Check if the initializer is an object
          if (node.init && node.init.type === 'ObjectExpression') {
            const properties = node.init.properties

            // Look for access property
            const accessProp = properties.find((prop) => prop.key && prop.key.name === 'access')

            if (!accessProp) {
              context.report({
                node,
                messageId: 'missingAccess',
                data: {
                  name: collectionName,
                },
              })
              return
            }

            // Verify all CRUD operations are defined
            if (accessProp.value && accessProp.value.type === 'ObjectExpression') {
              const accessProps = accessProp.value.properties
              const requiredOps = ['read', 'create', 'update', 'delete']
              const definedOps = accessProps
                .filter((prop) => prop.key && prop.key.name)
                .map((prop) => prop.key.name)

              const missingOps = requiredOps.filter((op) => !definedOps.includes(op))

              if (missingOps.length > 0) {
                context.report({
                  node: accessProp,
                  messageId: 'incompleteAccess',
                  data: {
                    name: collectionName,
                  },
                })
              }
            }
          }
        }
      },
    }
  },
}
export default rule
