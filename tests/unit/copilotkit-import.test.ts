import { describe, it, expect } from 'vitest'

describe('CopilotKit packages', () => {
  it('should export CopilotRuntime from @copilotkit/runtime', async () => {
    const mod = await import('@copilotkit/runtime')
    expect(mod.CopilotRuntime).toBeDefined()
  })

  it('should export GoogleGenerativeAIAdapter from @copilotkit/runtime', async () => {
    const mod = await import('@copilotkit/runtime')
    expect(mod.GoogleGenerativeAIAdapter).toBeDefined()
  })

  it('should export OpenAIAdapter from @copilotkit/runtime', async () => {
    const mod = await import('@copilotkit/runtime')
    expect(mod.OpenAIAdapter).toBeDefined()
  })
})
