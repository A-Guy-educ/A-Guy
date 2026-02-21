import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Cody page', () => {
  it('should be a client component', () => {
    const filePath = resolve(__dirname, '../../src/app/(cody)/cody/page.tsx')
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/['"]use client['"]/)
  })

  it('should export a default page function', () => {
    // Verify the file contains expected content
    const filePath = resolve(__dirname, '../../src/app/(cody)/cody/page.tsx')
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('export default')
    expect(content).toContain('CopilotKit')
    expect(content).toContain('CopilotChat')
    expect(content).toContain('getCurrentTime')
    expect(content).toContain('useCopilotAction')
  })
})
