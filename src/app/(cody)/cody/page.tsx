/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Test page for CopilotKit integration in Cody dashboard
 */
'use client'

import { CopilotChat } from '@copilotkit/react-ui'
import { useCopilotAction } from '@copilotkit/react-core'
import { useState } from 'react'

function TimeAction() {
  const [, setCurrentTime] = useState<string>('')

  useCopilotAction({
    name: 'getTime',
    description: 'Get the current time',
    handler: async () => {
      setCurrentTime(new Date().toISOString())
      return `Current time: ${new Date().toISOString()}`
    },
  })

  return null
}

export default function CodyTestPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <TimeAction />

      <h1 className="text-3xl font-bold mb-4">Cody Operations Dashboard</h1>
      <p className="mb-8 text-gray-400">This is a test page for CopilotKit integration.</p>

      <div className="border border-gray-700 rounded-lg overflow-hidden">
        <CopilotChat
          className="h-[500px]"
          labels={{
            placeholder: 'Ask me about Cody tasks, pipelines, or GitHub issues...',
          }}
        />
      </div>

      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Test Actions</h2>
        <p className="text-gray-400 text-sm">
          Try asking: &quot;What is the current time?&quot; to test CopilotKit actions.
        </p>
      </div>
    </div>
  )
}
