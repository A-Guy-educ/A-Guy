/**
 * @fileType test
 * @domain eslint | architecture
 * @ai-summary Tests for the tailwind-only-components ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/tailwind-only-components.mjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

describe('tailwind-only-components ESLint rule', () => {
  ruleTester.run('flags .scss import in component file', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import styles from './MyComponent.module.scss'`,
        filename: 'src/components/MyComponent.tsx',
        errors: [{ messageId: 'scssImport' }],
      },
    ],
  })

  ruleTester.run('flags .module.scss import in component file', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import styles from './Button.module.scss'`,
        filename: 'src/components/ui/Button.tsx',
        errors: [{ messageId: 'scssImport' }],
      },
    ],
  })

  ruleTester.run('flags .css import in component file', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import './globals.css'`,
        filename: 'src/components/Layout.tsx',
        errors: [{ messageId: 'scssImport' }],
      },
    ],
  })

  ruleTester.run('flags .module.css import in component file', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import styles from './Card.module.css'`,
        filename: 'src/components/Card.tsx',
        errors: [{ messageId: 'scssImport' }],
      },
    ],
  })

  ruleTester.run('accepts non-SCSS imports in component files', rule.default ?? rule, {
    valid: [
      {
        code: `import React from 'react'
          import { Button } from './Button'
          import { formatDate } from '@/lib/utils'`,
        filename: 'src/components/Form.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores files outside /components/ and /app/', rule.default ?? rule, {
    valid: [
      {
        code: `import styles from './legacy.module.scss'`,
        filename: 'src/server/service.ts',
      },
      {
        code: `import styles from './config.scss'`,
        filename: 'src/lib/helpers.ts',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores admin component files', rule.default ?? rule, {
    valid: [
      {
        code: `import styles from './AdminPanel.module.scss'`,
        filename: 'src/components/admin/AdminPanel.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('ignores src/ui/admin/ files', rule.default ?? rule, {
    valid: [
      {
        code: `import styles from './CustomField.module.scss'`,
        filename: 'src/ui/admin/CustomField.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags SCSS import in src/app/ files', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import './app.scss'`,
        filename: 'src/app/layout.tsx',
        errors: [{ messageId: 'scssImport' }],
      },
    ],
  })

  ruleTester.run('accepts SVG/image imports', rule.default ?? rule, {
    valid: [
      {
        code: `import Logo from './logo.svg'
          import Avatar from './avatar.png'`,
        filename: 'src/components/Header.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('accepts font imports', rule.default ?? rule, {
    valid: [
      {
        code: `import localFont from 'next/font/google'`,
        filename: 'src/app/layout.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run('flags multiple SCSS imports in same file', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import './base.scss'
          import './components/button.scss'`,
        filename: 'src/app/global.css',
        errors: [{ messageId: 'scssImport' }, { messageId: 'scssImport' }],
      },
    ],
  })

  ruleTester.run('accepts JSON imports', rule.default ?? rule, {
    valid: [
      {
        code: `import data from './data.json'`,
        filename: 'src/components/DataView.tsx',
      },
    ],
    invalid: [],
  })

  ruleTester.run(
    'ignores src/ui/web/ SCSS imports (not admin but not /components/)',
    rule.default ?? rule,
    {
      valid: [
        {
          code: `import styles from './web.module.scss'`,
          filename: 'src/ui/web/CustomComponent.tsx',
        },
      ],
      invalid: [],
    },
  )

  ruleTester.run('flags .scss in deeply nested component path', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import theme from '../styles/theme.scss'`,
        filename: 'src/components/cards/featured/Card.scss',
        errors: [{ messageId: 'scssImport' }],
      },
    ],
  })
})
