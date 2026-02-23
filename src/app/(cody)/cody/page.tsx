/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page with Kanban board and AI chat
 */
'use client'

import { useState, useEffect } from 'react'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'

export default function CodyPage() {
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(true)

  useEffect(() => {
    // Skip auth check for now - dashboard is open access
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
          <h1 className="text-xl font-semibold">Cody Operations</h1>
          <button
            onClick={() => setShowChat(!showChat)}
            className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
          >
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </button>
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Kanban Board */}
          <div className={`${showChat ? 'w-2/3' : 'w-full'} overflow-auto`}>
            <CodyDashboard />
          </div>

          {/* Chat Panel */}
          {showChat && (
            <div className="w-1/3 border-l overflow-hidden">
              <CopilotChat
                className="h-full"
                instructions="You are Cody, an AI assistant for the developer operations dashboard. You can help users understand their CI/CD pipeline, task status, and answer questions about the dashboard."
              />
            </div>
          )}
        </div>
      </div>
    </CopilotKit>
  )
}
