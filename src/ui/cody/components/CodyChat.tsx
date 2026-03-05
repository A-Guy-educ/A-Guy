'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Globe, Paperclip, X, Image as ImageIcon, FileText, FileCode } from 'lucide-react'
import { AGENTS, type AgentId } from '../agents'
import type { CodyTask } from '../types'
import type { ChatMessage, ChatSession } from '../chat-types'

const AGENT_LIST = Object.values(AGENTS).map(({ id, name, description, icon, capabilities }) => ({
  id,
  name,
  description,
  icon,
  capabilities,
}))

interface Message {
  role: 'user' | 'assistant'
  content: string
  isLoading?: boolean
}

interface ToolCall {
  name: string
  arguments: Record<string, unknown>
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  data: string // base64
  mimeType: string
}

/** Per-agent conversation history keyed by AgentId */
type HistoryMap = Record<AgentId, Message[]>

const emptyHistory = (): HistoryMap => ({
  'dashboard-manager': [],
  'prd-refiner': [],
  'system-architect': [],
})

const GLOBAL_CHAT_STORAGE_KEY = 'cody-global-chat'

function loadGlobalHistory(): HistoryMap {
  if (typeof window === 'undefined') return emptyHistory()
  try {
    const stored = localStorage.getItem(GLOBAL_CHAT_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...emptyHistory(), ...parsed }
    }
  } catch {
    // Ignore parse errors
  }
  return emptyHistory()
}

function saveGlobalHistory(history: HistoryMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GLOBAL_CHAT_STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

interface CodyChatProps {
  selectedTask?: CodyTask | null
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />
  if (
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  ) {
    return <FileCode className="w-4 h-4" />
  }
  return <FileText className="w-4 h-4" />
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CodyChat({ selectedTask }: CodyChatProps) {
  // Global (non-task) chat history
  const [globalHistory, setGlobalHistory] = useState<HistoryMap>(emptyHistory)

  // Load from localStorage after hydration (client-only)
  useEffect(() => {
    setGlobalHistory(loadGlobalHistory())
  }, [])

  // Task-scoped messages (loaded from / saved to API)
  const [taskMessages, setTaskMessages] = useState<Message[]>([])
  const [isLoadingTaskChat, setIsLoadingTaskChat] = useState(false)

  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('dashboard-manager')
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Determine if we're in task mode or global mode
  const isTaskMode = !!selectedTask

  // Current messages — from task or global history
  const messages = isTaskMode ? taskMessages : globalHistory[selectedAgent]

  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      if (isTaskMode) {
        // Task mode: update task messages directly
        setTaskMessages((prev) => (typeof updater === 'function' ? updater(prev) : updater))
      } else {
        // Global mode: update agent-specific history
        setGlobalHistory((prev) => ({
          ...prev,
          [selectedAgent]: typeof updater === 'function' ? updater(prev[selectedAgent]) : updater,
        }))
      }
    },
    [isTaskMode, selectedAgent],
  )

  // Load task chat when task changes
  useEffect(() => {
    if (selectedTask) {
      // Load chat from API
      setIsLoadingTaskChat(true)
      fetch(`/api/cody/chat/load?taskId=${selectedTask.id}`)
        .then(async (res) => {
          if (!res.ok) return null
          const data = await res.json()
          return data as { sessions: ChatSession[] } | null
        })
        .then((data) => {
          if (data?.sessions) {
            // Convert dashboard sessions to messages
            const dashboardSessions = data.sessions.filter((s) => s.stage === 'dashboard')
            const converted: Message[] = []
            for (const session of dashboardSessions) {
              for (const msg of session.messages) {
                converted.push({
                  role: msg.role,
                  content: msg.text,
                })
              }
            }
            setTaskMessages(converted)
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingTaskChat(false))
    } else {
      // Clear task messages when no task
      setTaskMessages([])
    }
  }, [selectedTask]) // eslint wants full object; re-runs are guarded by if(selectedTask)

  // Save task chat after each message exchange (debounced)
  const saveTaskChat = useCallback(async () => {
    if (!selectedTask || taskMessages.length === 0) return

    try {
      const messagesForApi: ChatMessage[] = taskMessages.map((m) => ({
        role: m.role,
        text: m.content,
        timestamp: new Date().toISOString(),
      }))

      await fetch('/api/cody/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTask.id,
          messages: messagesForApi,
        }),
      })
    } catch (err) {
      console.error('Failed to save chat:', err)
      // Non-fatal - don't bother user
    }
  }, [selectedTask, taskMessages])

  // Save after streaming completes — skip saves while loading to avoid race conditions
  useEffect(() => {
    if (isTaskMode && taskMessages.length > 0 && !loading) {
      const timer = setTimeout(saveTaskChat, 2000)
      return () => clearTimeout(timer)
    }
  }, [taskMessages, isTaskMode, loading, saveTaskChat])

  // Save global chat to localStorage when it changes (debounced)
  useEffect(() => {
    if (!isTaskMode && globalHistory && !loading) {
      const timer = setTimeout(() => saveGlobalHistory(globalHistory), 2000)
      return () => clearTimeout(timer)
    }
  }, [globalHistory, isTaskMode, loading])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const currentAgent = AGENT_LIST.find((a) => a.id === selectedAgent) ?? AGENT_LIST[0]

  const handleAgentChange = (agentId: AgentId) => {
    if (agentId === selectedAgent) {
      setShowAgentDropdown(false)
      return
    }

    // Abort any in-flight request before switching
    if (loading) {
      abortControllerRef.current?.abort()
      setLoading(false)
    }

    setSelectedAgent(agentId)
    setShowAgentDropdown(false)
    setToolCalls([])
  }

  const handleClearHistory = () => {
    if (messages.length === 0) return
    const confirmed = window.confirm('Clear conversation history?')
    if (!confirmed) return

    // Clear global chat from localStorage when clearing history in non-task mode
    if (!isTaskMode) {
      saveGlobalHistory(emptyHistory())
    }

    setMessages([])
    setToolCalls([])

    // If in task mode, also clear the saved chat
    if (isTaskMode && selectedTask) {
      fetch('/api/cody/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: selectedTask.id,
          messages: [], // Clear by saving empty
        }),
      }).catch(console.error)
    }
  }

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const MAX_SIZE = 5 * 1024 * 1024 // 5MB
    const newAttachments: Attachment[] = []

    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        alert(`File "${file.name}" is too large. Maximum size is 5MB.`)
        continue
      }

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          data: dataUrl,
          mimeType: file.type,
        })
      } catch (err) {
        console.error('Failed to read file:', err)
        alert(`Failed to read file "${file.name}"`)
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments])

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return

    const userMessage = input.trim()
    setInput('')
    setAttachments([]) // Clear attachments after sending

    // Build message content - include attachments as data URIs
    let messageContent = userMessage
    if (attachments.length > 0) {
      const attachmentDescriptions = attachments
        .map((a) => {
          const sizeStr = formatFileSize(a.size)
          if (a.mimeType.startsWith('image/')) {
            return `[Image: ${a.name} (${sizeStr})]\n${a.data}`
          }
          return `[File: ${a.name} (${a.mimeType}, ${sizeStr})]\n${a.data}`
        })
        .join('\n\n')

      messageContent = attachmentDescriptions + (userMessage ? `\n\n${userMessage}` : '')
    }

    setMessages((prev) => [...prev, { role: 'user', content: messageContent }])
    setLoading(true)
    setToolCalls([])

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: 'assistant', content: '', isLoading: true }])

    try {
      // Include task context in request when in task mode
      const requestBody: {
        agentId: AgentId
        messages: Array<{ role: 'user' | 'assistant'; content: string }>
        taskId?: string
        taskData?: {
          issueNumber: number
          title: string
          body: string
          state: string
          labels: string[]
          column: string
          pipeline?: {
            state: string
            currentStage: string | null
            stages: Record<string, { state: string }>
          }
          taskDefinition?: {
            task_type: string
            risk_level: string
            primary_domain: string
            scope: string[]
          }
          associatedPR?: {
            number: number
            state: string
            html_url: string
          }
        }
        attachments?: Array<{
          name: string
          mimeType: string
          data: string
        }>
      } = {
        agentId: selectedAgent,
        messages: [
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: messageContent },
        ],
      }

      // Include attachments in request
      if (attachments.length > 0) {
        requestBody.attachments = attachments.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          data: a.data,
        }))
      }

      if (selectedTask) {
        requestBody.taskId = selectedTask.id
        // Send task context for the AI to understand the task
        requestBody.taskData = {
          issueNumber: selectedTask.issueNumber,
          title: selectedTask.title,
          body: selectedTask.body,
          state: selectedTask.state,
          labels: selectedTask.labels,
          column: selectedTask.column,
          pipeline: selectedTask.pipeline
            ? {
                state: selectedTask.pipeline.state,
                currentStage: selectedTask.pipeline.currentStage,
                stages: selectedTask.pipeline.stages,
              }
            : undefined,
          taskDefinition: selectedTask.taskDefinition,
          associatedPR: selectedTask.associatedPR
            ? {
                number: selectedTask.associatedPR.number,
                state: selectedTask.associatedPR.state,
                html_url: selectedTask.associatedPR.html_url,
              }
            : undefined,
        }
      }

      const response = await fetch('/api/cody/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Handle streaming response - AI SDK v6 UI message stream (SSE format)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''

      // Parse SSE stream (AI SDK v6 UI message stream protocol)
      const parseSSEChunk = (text: string) => {
        const lines = text.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)

          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            switch (parsed.type) {
              case 'text-delta': {
                accumulatedContent += parsed.delta
                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMsg = newMessages[newMessages.length - 1]
                  if (lastMsg?.role === 'assistant') {
                    lastMsg.content = accumulatedContent
                  }
                  return newMessages
                })
                break
              }
              case 'tool-input-start': {
                setToolCalls((prev) => [...prev, { name: parsed.toolName, arguments: {} }])
                break
              }
              case 'tool-output-available': {
                // Tool result received - the model will continue with text after this
                break
              }
              case 'error': {
                console.error('Stream error:', parsed.errorText)
                break
              }
              // Ignore other event types
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

        // Process complete lines from buffer
        const lastNewline = buffer.lastIndexOf('\n')
        if (lastNewline !== -1) {
          const completeLines = buffer.slice(0, lastNewline + 1)
          buffer = buffer.slice(lastNewline + 1)
          parseSSEChunk(completeLines)
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        parseSSEChunk(buffer)
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

  // Generate placeholder based on mode
  const placeholder = isTaskMode
    ? `Ask about task #${selectedTask?.issueNumber}...`
    : `Ask ${currentAgent.name}...`

  const canSend = input.trim() || attachments.length > 0

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header with agent and context */}
      <div className="pl-4 pr-12 md:pr-4 py-3 border-b bg-gradient-to-r from-muted/80 to-muted/40">
        <div className="flex items-center justify-between">
          {/* Left: Agent icon + name + message count */}
          <div className="flex items-center gap-2">
            <span className="text-xl" role="img" aria-label={currentAgent.name}>
              {currentAgent.icon}
            </span>
            <span className="font-semibold text-sm">{currentAgent.name}</span>
            {messages.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                {messages.length}
              </span>
            )}
          </div>

          {/* Right: Agent selector dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowAgentDropdown(!showAgentDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background rounded-md border border-transparent hover:border-border transition-all"
            >
              <span>Switch</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showAgentDropdown && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-background border rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  Select Agent
                </div>
                {AGENT_LIST.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentChange(agent.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-start gap-3 transition-colors ${
                      agent.id === selectedAgent ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                  >
                    <span className="text-lg mt-0.5">{agent.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {agent.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Context bar: task or global */}
        <div className="mt-2">
          {isTaskMode && selectedTask ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-1.5 py-0.5 bg-primary text-primary-foreground rounded font-medium">
                #{selectedTask.issueNumber}
              </span>
              <span className="truncate text-muted-foreground">{selectedTask.title}</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              Global chat — not tied to any task
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && !loading && !isLoadingTaskChat && (
          <div className="text-center text-muted-foreground text-sm py-8">
            {isTaskMode ? (
              <>
                <p className="font-medium">Chat about this task</p>
                <p className="text-xs mt-1">Messages will be saved to the task</p>
              </>
            ) : (
              <>
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
                </ul>
              </>
            )}
          </div>
        )}

        {isLoadingTaskChat && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Loading conversation...
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

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs"
            >
              {getFileIcon(attachment.mimeType)}
              <span className="max-w-[100px] truncate">{attachment.name}</span>
              <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="ml-1 hover:text-destructive"
                disabled={loading}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t">
        <div className="flex gap-2 items-end">
          {/* Attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.json,.js,.ts,.jsx,.tsx,.html,.css,.scss,.yaml,.yml,.sh"
            onChange={handleFileSelect}
            className="hidden"
            disabled={loading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // Auto-expand height
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-hidden"
            disabled={loading}
            style={{ height: 'auto' }}
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
              disabled={!canSend}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
        {/* Clear history link */}
        {messages.length > 0 && !loading && (
          <button
            onClick={handleClearHistory}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear history
          </button>
        )}
      </div>
    </div>
  )
}
