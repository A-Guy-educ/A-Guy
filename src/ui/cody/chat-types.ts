/**
 * @fileType types
 * @domain cody | dashboard
 * @pattern chat-persistence
 * @ai-summary Shared types for chat persistence across dashboard and pipeline
 */

/**
 * A single message in a chat conversation.
 * Used for both dashboard chat and pipeline agent sessions.
 */
export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  tools?: string[]
  timestamp: string
  model?: string
}

/**
 * A session of chat messages.
 * For dashboard: a continuous conversation in task mode.
 * For pipeline: one agent stage execution.
 */
export interface ChatSession {
  /** Session type: 'dashboard' for user conversations, or pipeline stage name */
  stage: string
  /** OpenCode session ID (for pipeline sessions) */
  sessionId?: string
  /** When this session started */
  startedAt: string
  /** Messages in this session */
  messages: ChatMessage[]
}

/**
 * Complete chat history for a task.
 * Stored in .tasks/<taskId>/chat.json
 */
export interface ChatHistory {
  /** Schema version */
  version: 1
  /** Task ID this chat belongs to */
  taskId: string
  /** All sessions (pipeline + dashboard) */
  sessions: ChatSession[]
}
