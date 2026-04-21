/**
 * @fileType test
 * @domain eslint | security
 * @ai-summary Tests for the require-auth-endpoints ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/require-auth-endpoints.mjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

describe('require-auth-endpoints ESLint rule', () => {
  ruleTester.run('flags POST endpoint without auth check', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          export async function POST(req) {
            const data = await req.json()
            return Response.json(data)
          }
        `,
        filename: '/app/api/my-endpoint/route.ts',
        errors: [{ messageId: 'missingAuth', data: { name: 'POST' } }],
      },
    ],
  })

  ruleTester.run('flags GET endpoint without auth check', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          export async function GET(req) {
            const data = await req.json()
            return Response.json(data)
          }
        `,
        filename: '/app/api/items/route.ts',
        errors: [{ messageId: 'missingAuth', data: { name: 'GET' } }],
      },
    ],
  })

  ruleTester.run('accepts POST endpoint with payload.auth check', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function POST(req) {
            const { user } = await payload.auth({ headers: req.headers })
            if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            return Response.json({ success: true })
          }
        `,
        filename: '/app/api/users/route.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts GET endpoint with req.user check', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function GET(req) {
            if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
            return Response.json({ data: [] })
          }
        `,
        filename: '/app/api/protected/route.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts endpoint with getPayload auth', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function PUT(req) {
            const payload = await getPayload()
            const user = await payload.auth({ headers: req.headers })
            return Response.json({ ok: true })
          }
        `,
        filename: '/app/api/items/[id]/route.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run(
    'accepts endpoint with public endpoint comment (inside function body)',
    rule.default ?? rule,
    {
      valid: [
        {
          code: `
          export async function GET(req) {
            // public endpoint
            return Response.json({ public: true })
          }
        `,
          filename: '/app/api/public-data/route.ts',
        },
      ],
      invalid: [],
    },
  )

  ruleTester.run(
    'accepts endpoint with no auth required comment (inside function body)',
    rule.default ?? rule,
    {
      valid: [
        {
          code: `
          export async function POST(req) {
            // no auth required
            return Response.json({ ok: true })
          }
        `,
          filename: '/app/api/webhooks/route.ts',
        },
      ],
      invalid: [],
    },
  )

  ruleTester.run('ignores non-HTTP-method named functions', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function handler(req) {
            return Response.json({ ok: true })
          }
        `,
        filename: '/app/api/test/route.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run(
    'flags API file where helper outside exported fn has comment (comment not in fn body)',
    rule.default ?? rule,
    {
      valid: [],
      invalid: [
        {
          code: `
          async function processData(data) {
            // public endpoint
            return data
          }
          export async function GET(req) {
            const result = await processData(req)
            return Response.json(result)
          }
        `,
          filename: '/app/api/process/route.ts',
          errors: [{ messageId: 'missingAuth', data: { name: 'GET' } }],
        },
      ],
    },
  )

  ruleTester.run(
    'accepts endpoint with comment inside function body (not in separate helper)',
    rule.default ?? rule,
    {
      valid: [
        {
          code: `
          export async function GET(req) {
            // public endpoint
            const data = await fetchData()
            return Response.json(data)
          }
        `,
          filename: '/app/api/process/route.ts',
        },
      ],
      invalid: [],
    },
  )

  ruleTester.run('accepts DELETE endpoint with auth', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function DELETE(req) {
            const { user } = await payload.auth({ headers: req.headers })
            if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            return Response.json({ deleted: true })
          }
        `,
        filename: '/app/api/items/[id]/route.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags PATCH endpoint without auth', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `
          export async function PATCH(req) {
            const body = await req.json()
            return Response.json(body)
          }
        `,
        filename: '/app/api/users/[id]/route.ts',
        errors: [{ messageId: 'missingAuth', data: { name: 'PATCH' } }],
      },
    ],
  })

  ruleTester.run('ignores non-API route files', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function POST(req) {
            return Response.json({ ok: true })
          }
        `,
        filename: '/app/(frontend)/page.tsx',
      },
      {
        code: `
          export async function GET(req) {
            return Response.json({ ok: true })
          }
        `,
        filename: '/app/(payload)/custom/route.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts PUT endpoint with auth', rule.default ?? rule, {
    valid: [
      {
        code: `
          export async function PUT(req) {
            const { user } = await payload.auth({ headers: req.headers })
            if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            return Response.json({ updated: true })
          }
        `,
        filename: '/app/api/settings/route.ts',
      },
    ],
    invalid: [],
  })
})
