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
import { resolveOpenCodeBinary } from './opencode-server'

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
// Helper: Extract JSON object from potentially noisy CLI output
// ============================================================================

/**
 * Extract a JSON object from CLI output that may contain non-JSON lines
 * (e.g., progress messages, "Exporting session:" prefix, warnings).
 * Finds the first '{' and last '}' and parses the substring between them.
 */
export function extractJson(output: string): unknown {
  const firstBrace = output.indexOf('{')
  const lastBrace = output.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new SyntaxError(
      `No JSON object found in output (length=${output.length}, first 200 chars: ${output.slice(0, 200)})`,
    )
  }

  const jsonStr = output.slice(firstBrace, lastBrace + 1)
  return JSON.parse(jsonStr)
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
  serverUrl?: string,
): Promise<void> {
  if (!sessionId) {
    logger.debug('No sessionId, skipping chat export')
    return
  }

  logger.info(`  📝 Exporting chat session ${sessionId} for stage ${stage}...`)

  try {
    // Export session as JSON from the OpenCode SQLite DB.
    // `opencode export` reads directly from the DB — it does NOT support --attach.
    // When serverUrl is set, the DB lives in the task-specific data dir, so we use
    // the real binary + XDG_DATA_HOME. Without server mode, use pnpm exec (old binary).
    let output: string
    if (serverUrl) {
      const args = ['export', sessionId]
      const dataDir = path.join(taskDir, 'opencode-data')
      output = execFileSync(resolveOpenCodeBinary(), args, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        maxBuffer: 50 * 1024 * 1024,
        env: { ...process.env, XDG_DATA_HOME: dataDir },
      })
    } else {
      const args = ['exec', 'opencode', 'export', sessionId]
      output = execFileSync('pnpm', args, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        maxBuffer: 50 * 1024 * 1024,
      })
    }

    // Extract JSON from potentially noisy CLI output (may contain
    // "Exporting session:" prefix, progress messages, or other non-JSON lines)
    const rawExport = extractJson(output) as Parameters<typeof trimSession>[0]

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

    // R2-FIX #8: Cap sessions to prevent unbounded growth during retry loops.
    // Keep last 30 sessions — enough for full pipeline + several verify→fix loops.
    const MAX_CHAT_SESSIONS = 30
    if (history.sessions.length > MAX_CHAT_SESSIONS) {
      history.sessions = history.sessions.slice(-MAX_CHAT_SESSIONS)
      logger.info(`  ℹ️ Chat history trimmed to last ${MAX_CHAT_SESSIONS} sessions`)
    }

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
