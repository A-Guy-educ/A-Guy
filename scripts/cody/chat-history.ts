/**
 * @fileType utility
 * @domain cody | agent-execution
 * @pattern chat-history
 * @ai-summary Capture and manage agent conversation history from opencode sessions
 */

import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

import { logger } from './logger'

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant'
  stage: string
  text: string
  tools: string[]
  timestamp: string
  model?: string
}

export interface ChatSession {
  stage: string
  sessionId: string
  startedAt: string
  messages: ChatMessage[]
}

export interface ChatHistory {
  version: 1
  taskId: string
  sessions: ChatSession[]
}

// ============================================================================
// Helper: Trim raw opencode export to compact chat session
// ============================================================================

/**
 * Trim a raw opencode session export to a compact ChatSession structure.
 * Extracts role, text content, tool names, and timestamps.
 * Drops tool arguments/outputs and internal metadata for compactness.
 */
function trimSession(
  rawExport: {
    info?: { id?: string; time?: { created?: number } }
    messages?: Array<{
      info?: { role?: string; time?: { created?: number }; model?: string }
      parts?: Array<{
        type?: string
        text?: string
        tool?: string
      }>
    }>
  },
  stage: string,
): ChatSession | null {
  try {
    const info = rawExport.info || {}
    const messages = rawExport.messages || []

    const sessionId = info.id || 'unknown'
    const startedAt = info.time?.created
      ? new Date(info.time.created).toISOString()
      : new Date().toISOString()

    const trimmedMessages: ChatMessage[] = []

    for (const msg of messages) {
      const msgInfo = msg.info || {}
      // Cast role - opencode may return other values but we only handle user/assistant
      const role: 'user' | 'assistant' = msgInfo.role === 'assistant' ? 'assistant' : 'user'

      // Extract text from parts
      let text = ''
      const tools: string[] = []

      for (const part of msg.parts || []) {
        if (part.type === 'text' && part.text) {
          text += part.text
        }
        if (part.type === 'tool' && part.tool) {
          tools.push(part.tool)
        }
      }

      // Skip messages with no content
      if (!text && tools.length === 0) continue

      trimmedMessages.push({
        role,
        stage,
        text: text.trim(),
        tools,
        timestamp: msgInfo.time?.created
          ? new Date(msgInfo.time.created).toISOString()
          : new Date().toISOString(),
        model: msgInfo.model ? JSON.stringify(msgInfo.model) : undefined,
      })
    }

    return {
      stage,
      sessionId,
      startedAt,
      messages: trimmedMessages,
    }
  } catch (err) {
    logger.warn({ err }, `Failed to trim session for stage ${stage}`)
    return null
  }
}

// ============================================================================
// Helper: Load existing chat history
// ============================================================================

export function loadChatHistory(taskDir: string): ChatHistory | null {
  const chatPath = path.join(taskDir, 'chat.json')
  if (!fs.existsSync(chatPath)) {
    return null
  }
  try {
    const data = fs.readFileSync(chatPath, 'utf-8')
    return JSON.parse(data) as ChatHistory
  } catch (err) {
    logger.warn({ err, chatPath }, 'Failed to load chat history, starting fresh')
    return null
  }
}

// ============================================================================
// Helper: Save chat history
// ============================================================================

function saveChatHistory(taskDir: string, history: ChatHistory): void {
  const chatPath = path.join(taskDir, 'chat.json')
  fs.writeFileSync(chatPath, JSON.stringify(history, null, 2), 'utf-8')
}

// ============================================================================
// Main: Append a session to the task's chat history
// ============================================================================

/**
 * Export an opencode session and append its trimmed content to the task's chat.json.
 * This is called after a successful agent stage completes.
 *
 * @param taskDir - The .tasks/<taskId> directory
 * @param stage - The stage name (e.g., 'spec', 'build')
 * @param sessionId - The opencode session ID to export
 */
export async function appendSession(
  taskDir: string,
  stage: string,
  sessionId: string,
): Promise<void> {
  if (!sessionId) {
    logger.debug('No sessionId, skipping chat export')
    return
  }

  logger.info(`  📝 Exporting chat session ${sessionId} for stage ${stage}...`)

  try {
    // Export session as JSON
    const output = execFileSync('pnpm', ['exec', 'opencode', 'export', sessionId], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024, // 50MB — session exports can be very large
    }).replace(/^Exporting session:.*\n/, '') // Remove the "Exporting session:" line

    const rawExport = JSON.parse(output)

    // Trim to compact format
    const session = trimSession(rawExport, stage)
    if (!session) {
      logger.warn(`Failed to trim session ${sessionId}`)
      return
    }

    // Load or create chat history
    let history = loadChatHistory(taskDir)
    if (!history) {
      // Extract taskId from taskDir path
      const taskId = path.basename(taskDir)
      history = {
        version: 1,
        taskId,
        sessions: [],
      }
    }

    // Append the new session
    history.sessions.push(session)

    // Save
    saveChatHistory(taskDir, history)

    // Count total tools used across all messages
    const totalTools = session.messages.reduce((acc, m) => acc + m.tools.length, 0)

    logger.info(
      `  ✅ Saved chat for ${stage}: ${session.messages.length} messages, ${totalTools} tools used`,
    )
  } catch (err) {
    // Non-fatal — log and continue
    logger.warn({ err, sessionId, stage }, 'Failed to export/append chat session')
  }
}

// ============================================================================
// Utility: Get chat history for a task (for debugging/loading)
// ============================================================================

export function getChatHistoryForTask(taskId: string): ChatHistory | null {
  const taskDir = path.join(process.cwd(), '.tasks', taskId)
  return loadChatHistory(taskDir)
}
