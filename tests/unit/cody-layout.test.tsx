import { describe, it, expect } from 'vitest'

describe('Cody layout', () => {
  it('should export a default layout function', async () => {
    const mod = await import('@/app/(cody)/layout')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})
