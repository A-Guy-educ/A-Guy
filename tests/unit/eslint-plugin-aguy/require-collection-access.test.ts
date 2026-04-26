/**
 * @fileType test
 * @domain eslint | security
 * @ai-summary Tests for the require-collection-access ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/require-collection-access.mjs')

// Load the TypeScript parser for type annotation support
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tseslintParser = require('@typescript-eslint/parser')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tseslintParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
})

describe('require-collection-access ESLint rule', () => {
  ruleTester.run('flags collection without access field', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          import type { CollectionConfig } from 'payload'
          export const MyCollection: CollectionConfig = {
            slug: 'my-collection',
            fields: []
          }
        `,
        errors: [{ messageId: 'missingAccess', data: { name: 'MyCollection' } }],
      },
    ],
  })

  ruleTester.run('flags collection with empty access field', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          import type { CollectionConfig } from 'payload'
          export const Users: CollectionConfig = {
            slug: 'users',
            access: {},
            fields: []
          }
        `,
        errors: [{ messageId: 'incompleteAccess', data: { name: 'Users' } }],
      },
    ],
  })

  ruleTester.run('flags collection with partial access control', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          import type { CollectionConfig } from 'payload'
          export const Posts: CollectionConfig = {
            slug: 'posts',
            access: {
              read: () => true,
              create: () => true,
            },
            fields: []
          }
        `,
        errors: [{ messageId: 'incompleteAccess', data: { name: 'Posts' } }],
      },
    ],
  })

  ruleTester.run('accepts collection with all CRUD operations', rule.default ?? rule, {
    valid: [
      {
        code: `
          import type { CollectionConfig } from 'payload'
          export const Products: CollectionConfig = {
            slug: 'products',
            access: {
              read: () => true,
              create: isAdmin,
              update: isAdmin,
              delete: isAdmin,
            },
            fields: []
          }
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts collection with full access definitions', rule.default ?? rule, {
    valid: [
      {
        code: `
          import type { CollectionConfig } from 'payload'
          export const Articles: CollectionConfig = {
            slug: 'articles',
            admin: { useAsTitle: 'title' },
            access: {
              read: ({ req: { user } }) => Boolean(user),
              create: ({ req: { user } }) => user?.roles?.includes('admin'),
              update: ({ req: { user } }) => user?.roles?.includes('admin'),
              delete: ({ req: { user } }) => user?.roles?.includes('admin'),
            },
            fields: [{ name: 'title', type: 'text' }]
          }
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores non-CollectionConfig variable declarations', rule.default ?? rule, {
    valid: [
      {
        code: `
          const MyCollection = { slug: 'my-collection', fields: [] }
          export const Other = { name: 'test' }
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags multiple collections missing access in same file', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          import type { CollectionConfig } from 'payload'
          export const Coll1: CollectionConfig = { slug: 'coll1', fields: [] }
          export const Coll2: CollectionConfig = { slug: 'coll2', access: { read: () => true }, fields: [] }
        `,
        errors: [
          { messageId: 'missingAccess', data: { name: 'Coll1' } },
          { messageId: 'incompleteAccess', data: { name: 'Coll2' } },
        ],
      },
    ],
  })

  ruleTester.run(
    'accepts collection with access field with more than required ops',
    rule.default ?? rule,
    {
      valid: [
        {
          code: `
          import type { CollectionConfig } from 'payload'
          export const Events: CollectionConfig = {
            slug: 'events',
            access: {
              read: () => true,
              create: isAdmin,
              update: isAdmin,
              delete: isAdmin,
              admin: () => false,
            },
            fields: []
          }
        `,
        },
      ],
      invalid: [],
    },
  )
})
