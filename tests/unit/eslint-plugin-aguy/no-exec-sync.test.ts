/**
 * @fileType test
 * @domain eslint | security
 * @ai-summary Tests for the no-exec-sync ESLint rule
 */

import { describe, it, expect } from 'vitest'
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

describe('no-exec-sync ESLint rule', () => {
  it('flags execSync usage', () => {
    expect(() => {
      ruleTester.run('no-exec-sync', rule.default ?? rule, {
        valid: [],
        invalid: [
          {
            code: `execSync('ls -la')`,
            errors: [{ messageId: 'noExecSync' }],
          },
        ],
      })
    }).not.toThrow()
  })

  it('allows execFileSync usage', () => {
    expect(() => {
      ruleTester.run('no-exec-sync', rule.default ?? rule, {
        valid: [
          { code: `execFileSync('git', ['status'])` },
          { code: `const result = execFileSync('pnpm', ['test'])` },
        ],
        invalid: [],
      })
    }).not.toThrow()
  })

  it('flags member expression execSync', () => {
    expect(() => {
      ruleTester.run('no-exec-sync', rule.default ?? rule, {
        valid: [],
        invalid: [
          {
            code: `child_process.execSync('ls')`,
            errors: [{ messageId: 'noExecSync' }],
          },
        ],
      })
    }).not.toThrow()
  })

  it('flags destructured import of execSync', () => {
    expect(() => {
      ruleTester.run('no-exec-sync', rule.default ?? rule, {
        valid: [],
        invalid: [
          {
            code: `import { execSync } from 'child_process'`,
            errors: [{ messageId: 'noExecSync' }],
          },
        ],
      })
    }).not.toThrow()
  })

  it('does not flag execFileSync import', () => {
    expect(() => {
      ruleTester.run('no-exec-sync', rule.default ?? rule, {
        valid: [{ code: `import { execFileSync } from 'child_process'` }],
        invalid: [],
      })
    }).not.toThrow()
  })
})
