import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

describe('Spike result documentation', () => {
  const filePath = resolve(
    __dirname,
    '../../.tasks/260221-cody-operations-dashboard/spike-result.md',
  )

  it('should exist', () => {
    expect(existsSync(filePath)).toBe(true)
  })

  it('should contain required sections', () => {
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('## Summary')
    expect(content).toContain('## Adapter API Approach')
    expect(content).toContain('## Package Versions')
    expect(content).toContain('## Zod')
    expect(content).toContain('## React 19')
    expect(content).toContain('## Streaming')
    expect(content).toContain('## Issues')
  })
})
