/**
 * Smoke test for @kody bug command execution.
 *
 * Confirms that docs/kody-command-bug-smoke.md exists with a line confirming
 * the bug command ran on 2026-06-12.
 */

import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const SMOKE_FILE = path.join(__dirname, '../../docs/kody-command-bug-smoke.md')

describe('kody bug command smoke', () => {
  it('smoke file exists', () => {
    expect(fs.existsSync(SMOKE_FILE)).toBe(true)
  })

  it('smoke file contains confirmation line for 2026-06-12', () => {
    const content = fs.readFileSync(SMOKE_FILE, 'utf-8')
    expect(content).toContain('2026-06-12')
  })
})
