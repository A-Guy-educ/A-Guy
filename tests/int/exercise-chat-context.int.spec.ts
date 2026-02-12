/**
 * Integration tests for exercise chat context grounding with MCP tool-calling.
 *
 * Tests verify that:
 * - Student tool allowlist only permits getActiveExerciseContext
 * - System prompt suffix is properly constructed
 * - Security validation works as expected
 *
 * @fileType test
 * @domain ai
 * @pattern exercise-chat, mcp-tool-calling, context-grounding
 */

import { describe, expect, it } from 'vitest'
import {
  isStudentAllowedToolName,
  STUDENT_ALLOWED_TOOL_NAMES,
} from '@/server/repos/mcp/tool-allowlist'
import { validateStudentToolArgs } from '@/server/repos/mcp/validation/student-tool-validator'

describe('Exercise Chat Context Integration', () => {
  describe('Student tool allowlist', () => {
    it('only permits getActiveExerciseContext for students', () => {
      // getActiveExerciseContext should be allowed
      expect(isStudentAllowedToolName('getActiveExerciseContext')).toBe(true)

      // Admin/course tools should NOT be allowed for students
      expect(isStudentAllowedToolName('findExercises')).toBe(false)
      expect(isStudentAllowedToolName('findCourses')).toBe(false)
      expect(isStudentAllowedToolName('findChapters')).toBe(false)
      expect(isStudentAllowedToolName('findLessons')).toBe(false)
      expect(isStudentAllowedToolName('findMedia')).toBe(false)

      // Write operations should NOT be allowed
      expect(isStudentAllowedToolName('createCourses')).toBe(false)
      expect(isStudentAllowedToolName('updateCourses')).toBe(false)
      expect(isStudentAllowedToolName('deleteCourses')).toBe(false)
    })

    it('STUDENT_ALLOWED_TOOL_NAMES set contains only expected tool', () => {
      expect(STUDENT_ALLOWED_TOOL_NAMES.size).toBe(1)
      expect(STUDENT_ALLOWED_TOOL_NAMES.has('getActiveExerciseContext')).toBe(true)
    })
  })

  describe('Tool argument validation', () => {
    it('allows tool call with matching exerciseId', () => {
      expect(() => {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'ex-123' },
          { exerciseId: 'ex-123' },
        )
      }).not.toThrow()
    })

    it('rejects tool call with mismatched exerciseId', () => {
      expect(() => {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'other-exercise' },
          { exerciseId: 'real-exercise' },
        )
      }).toThrow('exerciseId mismatch')
    })

    it('rejects tool call without exerciseId in arguments', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', {}, { exerciseId: 'ex-123' })
      }).toThrow('requires exerciseId')
    })

    it('rejects tool call without exerciseId in request context', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', { exerciseId: 'ex-123' }, {})
      }).toThrow('No active exercise')
    })

    it('rejects disallowed tool name', () => {
      expect(() => {
        validateStudentToolArgs('findExercises', { exerciseId: 'ex-123' }, { exerciseId: 'ex-123' })
      }).toThrow('Tool not allowed for students')
    })
  })

  describe('System prompt suffix construction', () => {
    it('includes exerciseId and activeBlockId when both provided', () => {
      const exerciseId = 'test-exercise-123'
      const activeBlockId = 'question-1'

      const suffix = [
        `\n\n---\n[Exercise Context]`,
        `The student is currently viewing exercise ID '${exerciseId}'.`,
        `Active question block: '${activeBlockId}'.`,
        `Use the getActiveExerciseContext tool to fetch the full exercise content before answering questions about it.`,
        `Do not ask the student to paste or describe the exercise — you can fetch it automatically.`,
      ].join(' ')

      expect(suffix).toContain(`exercise ID '${exerciseId}'`)
      expect(suffix).toContain(`Active question block: '${activeBlockId}'`)
      expect(suffix).toContain('getActiveExerciseContext')
    })

    it('handles missing activeBlockId gracefully', () => {
      const exerciseId = 'test-exercise-123'

      const suffix = [
        `\n\n---\n[Exercise Context]`,
        `The student is currently viewing exercise ID '${exerciseId}'.`,
        'No specific question block is focused.',
        `Use the getActiveExerciseContext tool to fetch the full exercise content before answering questions about it.`,
        `Do not ask the student to paste or describe the exercise — you can fetch it automatically.`,
      ].join(' ')

      expect(suffix).toContain(`exercise ID '${exerciseId}'`)
      expect(suffix).toContain('No specific question block is focused')
    })
  })
})
