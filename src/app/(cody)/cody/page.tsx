'use client'

import { CopilotKit } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import { useCopilotAction } from '@copilotkit/react-core'

export default function CodyPage() {
  // Register a test action
  useCopilotAction({
    name: 'getCurrentTime',
    description: 'Get the current date and time',
    handler: async () => {
      return new Date().toISOString()
    },
  })

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Cody Dashboard (Spike)</h1>
      </header>
      <main className="flex-1">
        <CopilotKit runtimeUrl="/api/copilotkit">
          <CopilotChat />
        </CopilotKit>
      </main>
    </div>
  )
}
