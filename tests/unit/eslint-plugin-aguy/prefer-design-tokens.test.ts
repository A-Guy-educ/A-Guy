/**
 * @fileType test
 * @domain eslint | design-system
 * @ai-summary Tests for the prefer-design-tokens ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/prefer-design-tokens.mjs')
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
      ecmaFeatures: { jsx: true },
    },
  },
})

describe('prefer-design-tokens ESLint rule', () => {
  ruleTester.run('flags raw text-xs className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="text-xs">Small text</div>`,
        filename: 'src/ui/web/MyComponent.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'text-xs', raw: 'text-xs', suggestion: 'text-body-xs' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw text-sm className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<span className="text-sm">Label</span>`,
        filename: 'src/ui/web/FormField.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'text-sm', raw: 'text-sm', suggestion: 'text-body-sm' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw text-base className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<p className="text-base">Body</p>`,
        filename: 'src/ui/web/Paragraph.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'text-base', raw: 'text-base', suggestion: 'text-body-md' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw text-xl className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<h2 className="text-xl">Heading</h2>`,
        filename: 'src/ui/web/Heading.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: {
              token: 'text-xl',
              raw: 'text-xl',
              suggestion: 'text-heading-xl or text-heading-lg',
            },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw text-2xl className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<h1 className="text-2xl">Title</h1>`,
        filename: 'src/ui/web/PageTitle.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'text-2xl', raw: 'text-2xl', suggestion: 'text-heading-xl' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw p-4 className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="p-4">Content</div>`,
        filename: 'src/ui/web/Container.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'p-4', raw: 'p-4', suggestion: 'p-card-padding or p-card-padding-sm' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw p-6 className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<section className="p-6">Section</section>`,
        filename: 'src/ui/web/Section.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'p-6', raw: 'p-6', suggestion: 'p-card-padding' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw p-8 className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="p-8">Large padding</div>`,
        filename: 'src/ui/web/BigBox.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'p-8', raw: 'p-8', suggestion: 'p-card-padding-lg' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw shadow-sm className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="shadow-sm">Card</div>`,
        filename: 'src/ui/web/Card.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'shadow-sm', raw: 'shadow-sm', suggestion: 'shadow-elevation-1' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw shadow-md className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="shadow-md">Elevated</div>`,
        filename: 'src/ui/web/ElevatedBox.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: {
              token: 'shadow-md',
              raw: 'shadow-md',
              suggestion: 'shadow-elevation-2 or shadow-card',
            },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw shadow-lg className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="shadow-lg">Modal</div>`,
        filename: 'src/ui/web/Modal.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: {
              token: 'shadow-lg',
              raw: 'shadow-lg',
              suggestion: 'shadow-elevation-3 or shadow-card',
            },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw duration-100 className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<button className="duration-100">Fast</button>`,
        filename: 'src/ui/web/Button.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'duration-100', raw: 'duration-100', suggestion: 'duration-fast' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags raw duration-200 className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<button className="duration-200">Normal</button>`,
        filename: 'src/ui/web/Transition.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'duration-200', raw: 'duration-200', suggestion: 'duration-normal' },
          },
        ],
      },
    ],
  })

  ruleTester.run('accepts design token text-body-sm', rule.default ?? rule, {
    valid: [
      {
        code: `<span className="text-body-sm">Small label</span>`,
        filename: 'src/ui/web/Label.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts design token p-card-padding', rule.default ?? rule, {
    valid: [
      {
        code: `<div className="p-card-padding">Content</div>`,
        filename: 'src/ui/web/Box.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts design token shadow-elevation-2', rule.default ?? rule, {
    valid: [
      {
        code: `<div className="shadow-elevation-2">Elevated</div>`,
        filename: 'src/ui/web/Elevated.tsx',
      },
    ],
    invalid: [],
  })

  // Note: code must be valid JS/JSX syntax even for tests in non-ui/app paths
  // because ESLint parses the code before running the rule (rule returns early).
  ruleTester.run('ignores files outside src/ui/ and src/app/', rule.default ?? rule, {
    valid: [
      {
        // Non-JSX code to avoid parse error; rule returns early for this filename anyway
        code: `export const config = { name: 'test' }`,
        filename: 'src/server/service.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores src/lib/ files', rule.default ?? rule, {
    valid: [
      {
        code: `export const helper = () => 'helper'`,
        filename: 'src/lib/utils.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts src/app/ files with design tokens', rule.default ?? rule, {
    valid: [
      {
        code: `<div className="p-card-padding text-heading-xl">Styled</div>`,
        filename: 'src/app/(frontend)/page.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags raw gap-4 className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="gap-4">Grid</div>`,
        filename: 'src/ui/web/Grid.tsx',
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'gap-4', raw: 'gap-4', suggestion: 'gap-content-gap' },
          },
        ],
      },
    ],
  })

  ruleTester.run('flags multiple violations in single className', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `<div className="text-sm p-4 shadow-md">Multiple issues</div>`,
        filename: 'src/ui/web/Alert.tsx',
        // Each token produces an error with its own hydrated message
        errors: [
          {
            messageId: 'preferToken',
            data: { token: 'text-sm', raw: 'text-sm', suggestion: 'text-body-sm' },
          },
          {
            messageId: 'preferToken',
            data: { token: 'p-4', raw: 'p-4', suggestion: 'p-card-padding or p-card-padding-sm' },
          },
          {
            messageId: 'preferToken',
            data: {
              token: 'shadow-md',
              raw: 'shadow-md',
              suggestion: 'shadow-elevation-2 or shadow-card',
            },
          },
        ],
      },
    ],
  })

  ruleTester.run('respects disabledSuggestions option', rule.default ?? rule, {
    valid: [
      {
        code: `<span className="text-sm">Intentionally raw</span>`,
        filename: 'src/ui/web/RawText.tsx',
        options: [{ disabledSuggestions: ['text-sm'] }],
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts py-section-* spacing tokens', rule.default ?? rule, {
    valid: [
      {
        code: `<section className="py-section-md">Section</section>`,
        filename: 'src/ui/web/Section.tsx',
      },
    ],
    invalid: [],
  })
})
