/**
 * @fileType test
 * @domain cody | ui
 * @pattern task-parser
 * @ai-summary Tests for task-parser.ts - parsing GitHub comments to extract Cody task status
 */

import { describe, it, expect } from 'vitest'
import { parseComment, parseAllComments } from '../../../../src/ui/cody/task-parser'

describe('task-parser', () => {
  describe('parseComment', () => {
    // Gate approval - both /cody and @cody prefixes should work
    it('should parse /cody approve as gate-approval', () => {
      const result = parseComment({
        body: '/cody approve',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-approval')
    })

    it('should parse @cody approve as gate-approval', () => {
      const result = parseComment({
        body: '@cody approve',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-approval')
    })

    it('should parse @cody approve with answer as gate-approval', () => {
      const result = parseComment({
        body: '@cody approve use TypeScript',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-approval')
    })

    it('should parse @cody approve with multiline answer as gate-approval', () => {
      const result = parseComment({
        body: '@cody approve\n1. yes\n2. use MongoDB',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-approval')
    })

    it('should parse /cody reject as gate-rejection', () => {
      const result = parseComment({
        body: '/cody reject',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-rejection')
    })

    it('should parse @cody reject as gate-rejection', () => {
      const result = parseComment({
        body: '@cody reject not ready',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-rejection')
    })

    // Task marker
    it('should parse task marker comment', () => {
      const result = parseComment({
        body: '🎯 Task created: `260308-fix-bug` (`full` mode)',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('task-marker')
      expect(result?.taskId).toBe('260308-fix-bug')
    })

    // Gate request (should still be recognized)
    it('should parse gate request comment', () => {
      const result = parseComment({
        body: '## 🚦 Risk Gate\n\nPaused at architect gate.',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).not.toBeNull()
      expect(result?.type).toBe('gate-request')
    })

    // Unknown comment
    it('should return null for unknown comment', () => {
      const result = parseComment({
        body: 'Just a regular comment',
        created_at: '2026-03-08T12:00:00Z',
      })

      expect(result).toBeNull()
    })
  })

  describe('parseAllComments', () => {
    it('should sort comments by date (oldest first)', () => {
      const comments = [
        { body: '@cody approve', created_at: '2026-03-08T14:00:00Z' },
        { body: '🎯 Task created: `260308-test`', created_at: '2026-03-08T10:00:00Z' },
        { body: '/cody reject', created_at: '2026-03-08T12:00:00Z' },
      ]

      const result = parseAllComments(comments)

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('task-marker')
      expect(result[1].type).toBe('gate-rejection')
      expect(result[2].type).toBe('gate-approval')
    })
  })
})
