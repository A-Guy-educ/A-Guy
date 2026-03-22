/**
 * @fileType utility
 * @domain remote-agent
 * @pattern request-handlers
 * @ai-summary Route handlers for exec, read, write, ls operations with security constraints
 */

import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import {
  REMOTE_AGENT_ALLOWED_ROOTS,
  EXEC_MAX_BYTES,
  READ_MAX_BYTES,
  LS_MAX_ENTRIES,
  EXEC_TIMEOUT_MS,
  EXEC_DENY_LIST,
} from './config'

// ============ Path Containment ============

/**
 * Validates that the given file path is contained within one of the allowed roots.
 * Returns the normalized absolute path if valid, or throws.
 */
export function validatePath(filePath: unknown): string {
  if (typeof filePath !== 'string' || !filePath) {
    throw new Error('path must be a non-empty string')
  }

  const normalized = path.resolve(filePath)

  if (REMOTE_AGENT_ALLOWED_ROOTS.length === 0) {
    throw new Error('REMOTE_AGENT_ALLOWED_ROOTS is not configured — file operations are disabled')
  }

  const allowed = REMOTE_AGENT_ALLOWED_ROOTS.some((root) => {
    const normalizedRoot = path.resolve(root)
    return normalized.startsWith(normalizedRoot + path.sep) || normalized === normalizedRoot
  })

  if (!allowed) {
    throw new Error(`Path '${normalized}' is not within any allowed root`)
  }

  return normalized
}

// ============ Exec Handler ============

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number | null
  truncated: boolean
}

/**
 * Executes a shell command with deny-list check, 30s timeout, and 512KB output cap.
 */
export async function handleExec(body: Record<string, unknown>): Promise<ExecResult> {
  const command = body.command
  if (typeof command !== 'string' || !command.trim()) {
    throw new Error('command must be a non-empty string')
  }

  const cwd = typeof body.cwd === 'string' && body.cwd ? validatePath(body.cwd) : process.cwd()

  // Check deny-list
  for (const denied of EXEC_DENY_LIST) {
    if (command.includes(denied)) {
      throw new Error(`Command contains denied pattern: '${denied}'`)
    }
  }

  return new Promise((resolve, reject) => {
    const child = exec(
      command,
      { cwd, timeout: EXEC_TIMEOUT_MS, maxBuffer: EXEC_MAX_BYTES * 2 },
      (err, stdout, stderr) => {
        let truncated = false
        let outStr = stdout ?? ''
        let errStr = stderr ?? ''

        // Cap output at EXEC_MAX_BYTES
        if (Buffer.byteLength(outStr) > EXEC_MAX_BYTES) {
          outStr = Buffer.from(outStr).subarray(0, EXEC_MAX_BYTES).toString('utf-8')
          truncated = true
        }
        if (Buffer.byteLength(errStr) > EXEC_MAX_BYTES) {
          errStr = Buffer.from(errStr).subarray(0, EXEC_MAX_BYTES).toString('utf-8')
          truncated = true
        }

        if (err && err.killed) {
          resolve({
            stdout: outStr,
            stderr: errStr + '\n[Killed: timeout exceeded]',
            exitCode: null,
            truncated,
          })
          return
        }

        resolve({
          stdout: outStr,
          stderr: errStr,
          exitCode: err?.code ?? 0,
          truncated,
        })
      },
    )

    child.on('error', reject)
  })
}

// ============ Read Handler ============

export interface ReadResult {
  content: string
  size: number
  truncated: boolean
}

/**
 * Reads a file. Enforces path containment and 1MB size cap.
 */
export async function handleRead(body: Record<string, unknown>): Promise<ReadResult> {
  const filePath = validatePath(body.path)

  const stat = await fs.stat(filePath)
  if (!stat.isFile()) {
    throw new Error(`'${filePath}' is not a file`)
  }

  let truncated = false
  let content: string

  if (stat.size > READ_MAX_BYTES) {
    // Read only up to READ_MAX_BYTES
    const fd = await fs.open(filePath, 'r')
    try {
      const buf = Buffer.alloc(READ_MAX_BYTES)
      await fd.read(buf, 0, READ_MAX_BYTES, 0)
      content = buf.toString('utf-8')
      truncated = true
    } finally {
      await fd.close()
    }
  } else {
    content = await fs.readFile(filePath, 'utf-8')
  }

  return { content, size: stat.size, truncated }
}

// ============ Write Handler ============

export interface WriteResult {
  success: boolean
  path: string
}

/**
 * Writes content to a file. Enforces path containment.
 * Creates parent directories if needed.
 */
export async function handleWrite(body: Record<string, unknown>): Promise<WriteResult> {
  const filePath = validatePath(body.path)
  const content = body.content

  if (typeof content !== 'string') {
    throw new Error('content must be a string')
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')

  return { success: true, path: filePath }
}

// ============ Ls Handler ============

export interface LsEntry {
  name: string
  type: 'file' | 'directory' | 'symlink' | 'other'
  size?: number
}

export interface LsResult {
  entries: LsEntry[]
  total: number
  truncated: boolean
}

/**
 * Lists directory contents. Enforces path containment and 500 entry cap.
 */
export async function handleLs(body: Record<string, unknown>): Promise<LsResult> {
  const dirPath = validatePath(body.path)

  const stat = await fs.stat(dirPath)
  if (!stat.isDirectory()) {
    throw new Error(`'${dirPath}' is not a directory`)
  }

  const dirents = await fs.readdir(dirPath, { withFileTypes: true })
  const total = dirents.length
  const truncated = total > LS_MAX_ENTRIES

  const entries: LsEntry[] = await Promise.all(
    dirents.slice(0, LS_MAX_ENTRIES).map(async (d): Promise<LsEntry> => {
      const type: LsEntry['type'] = d.isFile()
        ? 'file'
        : d.isDirectory()
          ? 'directory'
          : d.isSymbolicLink()
            ? 'symlink'
            : 'other'

      let size: number | undefined
      if (type === 'file') {
        try {
          const s = await fs.stat(path.join(dirPath, d.name))
          size = s.size
        } catch {
          // Skip if stat fails
        }
      }

      return { name: d.name, type, size }
    }),
  )

  return { entries, total, truncated }
}
