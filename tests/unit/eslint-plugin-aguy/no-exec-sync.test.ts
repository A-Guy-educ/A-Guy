/**
 * @fileType test
 * @domain eslint | security
 * @ai-summary Tests for the no-exec-sync ESLint rule
 */

import { describe } from 'vitest'
import { RuleTester } from 'eslint'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require('../../../eslint-plugin-aguy/rules/no-exec-sync.mjs')

// RuleTester requires a parser config
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

// RuleTester.run() internally calls describe()/it(), so it must be called
// at the describe level, NOT inside an it() block.
// vitest 4.x forbids nesting suite functions inside test functions.

describe('no-exec-sync ESLint rule', () => {
  ruleTester.run('flags execSync usage', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `execSync('ls -la')`,
        errors: [{ messageId: 'noExecSync' }],
      },
    ],
  })

  ruleTester.run('allows execFileSync usage', rule.default ?? rule, {
    valid: [
      { code: `execFileSync('git', ['status'])` },
      { code: `const result = execFileSync('pnpm', ['test'])` },
    ],
    invalid: [],
  })

  ruleTester.run('flags member expression execSync', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `child_process.execSync('ls')`,
        errors: [{ messageId: 'noExecSync' }],
      },
    ],
  })

  ruleTester.run('flags destructured import of execSync', rule.default ?? rule, {
    valid: [],
    invalid: [
      {
        code: `import { execSync } from 'child_process'`,
        errors: [{ messageId: 'noExecSync' }],
      },
    ],
  })

  ruleTester.run('does not flag execFileSync import', rule.default ?? rule, {
    valid: [{ code: `import { execFileSync } from 'child_process'` }],
    invalid: [],
  })
})
