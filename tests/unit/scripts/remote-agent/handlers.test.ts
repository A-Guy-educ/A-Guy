/**
 * Unit tests for remote agent handlers
 */
import { describe, it, expect, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

// Mock config to use temp dir as allowed root
const tmpDir = os.tmpdir()

vi.mock('../../../../scripts/remote-agent/config', () => ({
  REMOTE_AGENT_KEY: 'test-secret-key',
  REMOTE_AGENT_PORT: 3456,
  REMOTE_AGENT_ALLOWED_ROOTS: [os.tmpdir()],
  EXEC_MAX_BYTES: 512 * 1024,
  READ_MAX_BYTES: 1024 * 1024,
  LS_MAX_ENTRIES: 500,
  EXEC_TIMEOUT_MS: 30000,
  EXEC_DENY_LIST: ['sudo', 'rm -rf /', 'mkfs', 'dd if=', 'shutdown', 'reboot'],
}))

import {
  validatePath,
  handleExec,
  handleRead,
  handleWrite,
  handleLs,
} from '../../../../scripts/remote-agent/handlers'

describe('validatePath', () => {
  it('accepts path within allowed root', () => {
    const p = path.join(tmpDir, 'some-file.txt')
    expect(() => validatePath(p)).not.toThrow()
    expect(validatePath(p)).toBe(path.resolve(p))
  })

  it('rejects path outside allowed roots', () => {
    expect(() => validatePath('/etc/passwd')).toThrow('not within any allowed root')
  })

  it('rejects non-string input', () => {
    expect(() => validatePath(42)).toThrow('path must be a non-empty string')
  })

  it('rejects empty string', () => {
    expect(() => validatePath('')).toThrow('path must be a non-empty string')
  })
})

describe('handleExec', () => {
  it('executes a simple command', async () => {
    const result = await handleExec({ command: 'echo hello' })
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
  })

  it('captures stderr and non-zero exit codes', async () => {
    const result = await handleExec({ command: 'ls /nonexistent-path-xyz' })
    expect(result.exitCode).not.toBe(0)
  })

  it('rejects denied commands', async () => {
    await expect(handleExec({ command: 'sudo ls' })).rejects.toThrow("denied pattern: 'sudo'")
  })

  it('rejects missing command', async () => {
    await expect(handleExec({})).rejects.toThrow('command must be a non-empty string')
  })
})

describe('handleRead', () => {
  it('reads an existing file', async () => {
    const filePath = path.join(tmpDir, `test-read-${Date.now()}.txt`)
    await fs.writeFile(filePath, 'hello world', 'utf-8')

    const result = await handleRead({ path: filePath })
    expect(result.content).toBe('hello world')
    expect(result.truncated).toBe(false)

    await fs.unlink(filePath)
  })

  it('rejects path outside allowed roots', async () => {
    await expect(handleRead({ path: '/etc/hosts' })).rejects.toThrow('not within any allowed root')
  })

  it('rejects non-existent file (stat throws)', async () => {
    await expect(handleRead({ path: path.join(tmpDir, 'nonexistent-xyz.txt') })).rejects.toThrow()
  })
})

describe('handleWrite', () => {
  it('writes a file and confirms', async () => {
    const filePath = path.join(tmpDir, `test-write-${Date.now()}.txt`)
    const result = await handleWrite({ path: filePath, content: 'test content' })

    expect(result.success).toBe(true)
    expect(result.path).toBe(path.resolve(filePath))

    const written = await fs.readFile(filePath, 'utf-8')
    expect(written).toBe('test content')

    await fs.unlink(filePath)
  })

  it('rejects path outside allowed roots', async () => {
    await expect(handleWrite({ path: '/etc/test.txt', content: 'data' })).rejects.toThrow(
      'not within any allowed root',
    )
  })

  it('rejects non-string content', async () => {
    const filePath = path.join(tmpDir, 'test.txt')
    await expect(handleWrite({ path: filePath, content: 123 })).rejects.toThrow(
      'content must be a string',
    )
  })
})

describe('handleLs', () => {
  it('lists a directory', async () => {
    const testDir = path.join(tmpDir, `test-ls-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(path.join(testDir, 'a.txt'), '')
    await fs.writeFile(path.join(testDir, 'b.txt'), '')

    const result = await handleLs({ path: testDir })
    expect(result.entries.length).toBeGreaterThanOrEqual(2)
    expect(result.entries.some((e) => e.name === 'a.txt')).toBe(true)

    await fs.rm(testDir, { recursive: true })
  })

  it('rejects non-directory path', async () => {
    const filePath = path.join(tmpDir, `test-ls-file-${Date.now()}.txt`)
    await fs.writeFile(filePath, '')
    await expect(handleLs({ path: filePath })).rejects.toThrow('is not a directory')
    await fs.unlink(filePath)
  })
})
