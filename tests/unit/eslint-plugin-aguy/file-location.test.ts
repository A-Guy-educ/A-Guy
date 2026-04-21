/**
 * @fileType test
 * @domain eslint | architecture
 * @ai-summary Tests for the file-location ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/file-location.mjs')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tseslintParser = require('@typescript-eslint/parser')

// Use TypeScript ESLint parser to support JSX in test code
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: tseslintParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
  },
})

// Note: invalid test cases use code strings without leading indentation to avoid
// fix-range mismatch issues caused by template literal whitespace preservation.

describe('file-location ESLint rule', () => {
  ruleTester.run('flags React component in src/components/', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import React from 'react'\nexport const MyComponent = () => {\n  return <div>Hello</div>\n}`,
        filename: 'src/components/MyComponent.tsx',
        errors: [
          { messageId: 'deprecatedLocation', data: { destination: 'src/ui/web/MyComponent.tsx' } },
        ],
      },
    ],
  })

  ruleTester.run('flags React component in src/components/ui/', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import React from 'react'\nexport const Button = () => <button>Click</button>`,
        filename: 'src/components/ui/Button.tsx',
        errors: [
          {
            messageId: 'deprecatedLocation',
            data: { destination: 'src/ui/web/components/Button.tsx' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags React component in src/components/courses/', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import React from 'react'\nexport const CourseCard = () => <div>Course</div>`,
        filename: 'src/components/courses/CourseCard.tsx',
        errors: [
          {
            messageId: 'deprecatedLocation',
            data: { destination: 'src/ui/web/courses/CourseCard.tsx' },
          },
        ],
      },
    ],
  })

  ruleTester.run('ignores non-React code in src/components/', rule.default ?? rule, {
    valid: [
      {
        // No export keyword — not a React component by any pattern
        code: `const CONFIG = Object.freeze({ name: 'test' })`,
        filename: 'src/components/config.ts',
      },
      {
        // Named export of a primitive — does not match any React pattern
        code: `export { CONFIG }`,
        filename: 'src/components/registry.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores React component in src/ui/web/', rule.default ?? rule, {
    valid: [
      {
        code: `import React from 'react'\nexport const Header = () => <header>Site Header</header>`,
        filename: 'src/ui/web/Header.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores React component in src/ui/admin/', rule.default ?? rule, {
    valid: [
      {
        code: `'use client'\nimport { useState } from 'react'\nexport const AdminPanel = () => <div>Admin</div>`,
        filename: 'src/ui/admin/AdminPanel.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run(
    'flags React component with next/image import in src/components/',
    rule.default ?? rule,
    {
      valid: [],
      invalid: [
        {
          code: `import Image from 'next/image'\nexport default function Avatar() {\n  return <Image src="/avatar.png" alt="avatar" />\n}`,
          filename: 'src/components/Avatar.tsx',
          errors: [
            { messageId: 'deprecatedLocation', data: { destination: 'src/ui/web/Avatar.tsx' } },
          ],
        },
      ],
    },
  )

  ruleTester.run(
    'flags React component with next/link import in src/components/',
    rule.default ?? rule,
    {
      valid: [],
      invalid: [
        {
          code: `import Link from 'next/link'\nexport const Nav = () => <Link href="/">Home</Link>`,
          filename: 'src/components/Nav.tsx',
          errors: [
            { messageId: 'deprecatedLocation', data: { destination: 'src/ui/web/Nav.tsx' } },
          ],
        },
      ],
    },
  )

  ruleTester.run('ignores non-React code in src/lib/', rule.default ?? rule, {
    valid: [
      {
        code: `import React from 'react'\nexport const config = { name: 'test' }`,
        filename: 'src/lib/config.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('respects allowList option', rule.default ?? rule, {
    valid: [
      {
        code: `import React from 'react'\nexport const LegacyWrapper = () => <div>Legacy</div>`,
        filename: 'src/components/legacy/LegacyWrapper.tsx',
        options: [{ allowList: ['src/components/legacy/'] }],
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores node_modules files', rule.default ?? rule, {
    valid: [
      {
        code: `import React from 'react'\nexport const External = () => <div>External</div>`,
        filename: 'node_modules/some-package/Component.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags export function component in src/components/', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `export function Footer() {\n  return <footer>Site Footer</footer>\n}`,
        filename: 'src/components/Footer.tsx',
        errors: [{ messageId: 'deprecatedLocation' }],
      },
    ],
  })

  ruleTester.run('flags export default class component in src/components/', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import React from 'react'\nexport default class Card extends React.Component {\n  render() {\n    return <div>Card</div>\n  }\n}`,
        filename: 'src/components/Card.tsx',
        errors: [{ messageId: 'deprecatedLocation' }],
      },
    ],
  })

  ruleTester.run('ignores file in src/ui/shared/ without React imports', rule.default ?? rule, {
    valid: [
      {
        // No export keyword — avoids matching export patterns
        code: `const UTILITY = Object.assign({}, { foo: 'bar' })`,
        filename: 'src/ui/shared/utility.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores deeply nested component in src/ui/web/', rule.default ?? rule, {
    valid: [
      {
        code: `import React from 'react'\nexport const DeepCard = () => <div>Deep</div>`,
        filename: 'src/ui/web/cards/featured/DeepCard.tsx',
      },
    ],
    invalid: [],
  })
})
