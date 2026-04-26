/**
 * @fileType test
 * @domain eslint | security
 * @ai-summary Tests for the no-nested-metadata ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/no-nested-metadata.mjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

// Note: All code is wrapped in array syntax [...] to avoid parsing as block statement.
// The rule checks Property nodes within array elements (each element is an ObjectExpression).

describe('no-nested-metadata ESLint rule', () => {
  ruleTester.run('flags group field containing a json field', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          [
            {
              name: 'user',
              type: 'group',
              fields: [
                { name: 'profile', type: 'json' }
              ]
            }
          ]
        `,
        errors: [{ messageId: 'nestedMetadata' }],
      },
    ],
  })

  ruleTester.run('accepts flat field structure with text fields', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'text' }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts group field with only text fields', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            {
              name: 'author',
              type: 'group',
              fields: [
                { name: 'firstName', type: 'text' },
                { name: 'lastName', type: 'text' }
              ]
            }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts top-level json field', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            { name: 'title', type: 'text' },
            { name: 'metadata', type: 'json' }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts group with mixed non-json fields', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            {
              name: 'contact',
              type: 'group',
              fields: [
                { name: 'email', type: 'email' },
                { name: 'phone', type: 'text' },
                { name: 'address', type: 'text' }
              ]
            }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags group with json field among others', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          [
            {
              name: 'extendedInfo',
              type: 'group',
              fields: [
                { name: 'name', type: 'text' },
                { name: 'data', type: 'json' },
                { name: 'tags', type: 'text' }
              ]
            }
          ]
        `,
        errors: [{ messageId: 'nestedMetadata' }],
      },
    ],
  })

  ruleTester.run('accepts array field type', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            {
              name: 'tags',
              type: 'array',
              fields: [
                { name: 'tag', type: 'text' }
              ]
            }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts relationship field', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            { name: 'category', type: 'relationship', relationTo: 'categories' }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags multiple group fields with json in one of them', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          [
            {
              name: 'author',
              type: 'group',
              fields: [
                { name: 'name', type: 'text' }
              ]
            },
            {
              name: 'metadata',
              type: 'group',
              fields: [
                { name: 'extra', type: 'json' }
              ]
            }
          ]
        `,
        errors: [{ messageId: 'nestedMetadata' }],
      },
    ],
  })

  ruleTester.run('accepts group with upload field', rule.default ?? rule, {
    valid: [
      {
        code: `
          [
            {
              name: 'thumbnail',
              type: 'group',
              fields: [
                { name: 'url', type: 'text' },
                { name: 'alt', type: 'text' }
              ]
            }
          ]
        `,
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags group with multiple json fields', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          [
            {
              name: 'data',
              type: 'group',
              fields: [
                { name: 'primary', type: 'json' },
                { name: 'secondary', type: 'json' }
              ]
            }
          ]
        `,
        errors: [{ messageId: 'nestedMetadata' }],
      },
    ],
  })
})
