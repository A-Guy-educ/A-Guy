'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isLoading?: boolean
}

interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

export function CodyChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    setToolCalls([])

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: 'assistant', content: '', isLoading: true }])

    try {
      const response = await fetch('/api/cody/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content: userMessage },
          ],
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''

      // Parse NDJSON stream
      const parseChunk = (text: string) => {
        const lines = text.split('\n')
        for (const line of lines) {
          if (!line.trim()) continue

          // Handle Vercel AI SDK data stream format
          // 0: = text, a: = tool call, b: = tool result, d: = done, e: = error
          const prefix = line[0]
          const data = line.slice(2) // Skip prefix and colon (e.g., "0:")

          try {
            const parsed = JSON.parse(data)

            // Handle different message types from AI SDK
            if (prefix === '0') {
              // Text delta
              accumulatedContent += parsed
              setMessages((prev) => {
                const newMessages = [...prev]
                const lastMsg = newMessages[newMessages.length - 1]
                if (lastMsg?.role === 'assistant') {
                  lastMsg.content = accumulatedContent
                }
                return newMessages
              })
            } else if (prefix === 'a') {
              // Tool call start
              setToolCalls((prev) => [...prev, { name: parsed.toolName, arguments: {} }])
            } else if (prefix === 'e') {
              console.error('Stream error:', parsed)
            } else if (prefix === 'd' || prefix === 'd') {
              // Done message - handled by stream end
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        parseChunk(buffer)
        buffer = ''
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled - don't update messages
        setMessages((prev) => prev.slice(0, -1))
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg?.role === 'assistant') {
          lastMsg.content = `Error: ${errorMessage}`
          lastMsg.isLoading = false
        }
        return newMessages
      })
    } finally {
      setLoading(false)
      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg?.role === 'assistant') {
          lastMsg.isLoading = false
        }
        return newMessages
      })
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setLoading(false)
    setMessages((prev) => {
      const newMessages = [...prev]
      const lastMsg = newMessages[newMessages.length - 1]
      if (lastMsg?.role === 'assistant') {
        lastMsg.isLoading = false
      }
      return newMessages
    })
  }

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="px-4 py-2 border-b bg-muted/50">
        <h2 className="font-semibold text-sm">Cody Assistant</h2>
        <p className="text-xs text-muted-foreground">Ask about tasks, code, or pipeline</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <p className="font-medium">Hi! I can help you with:</p>
            <ul className="mt-3 text-left text-xs space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Browse repository files and code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Search code across the codebase</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>List and explain tasks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Show pipeline status and progress</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>View workflow runs and PRs</span>
              </li>
            </ul>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>
                    {msg.content || (msg.isLoading ? '_Thinking..._' : '')}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
              {msg.isLoading && msg.role === 'assistant' && (
                <span className="inline-block ml-2 animate-pulse text-primary">●</span>
              )}
            </div>
          </div>
        ))}

        {/* Tool calls display */}
        {toolCalls.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-xs">
              <p className="font-medium mb-1">Using tools:</p>
              <ul className="space-y-1">
                {toolCalls.map((tc, i) => (
                  <li key={i} className="text-blue-600 dark:text-blue-400">
                    • {tc.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about code, tasks, or pipeline..."
            className="flex-1 px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={loading}
          />
          {loading ? (
            <button
              onClick={handleStop}
              className="px-3 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
