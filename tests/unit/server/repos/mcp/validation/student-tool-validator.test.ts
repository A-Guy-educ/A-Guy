/**
 * Unit Tests for Student Tool Validator
 *
 * Tests that validate student tool arguments to prevent security issues
 * like fetching arbitrary exercises via tool args.
 *
 * @fileType test
 * @domain mcp
 * @pattern security, tool-calling, student-access
 */

import { describe, expect, it } from 'vitest'
import {
  validateStudentToolArgs,
  type StudentToolRequestContext,
} from '@/server/repos/mcp/validation/student-tool-validator'

describe('Student Tool Validator', () => {
  const createContext = (
    overrides?: Partial<StudentToolRequestContext>,
  ): StudentToolRequestContext => ({
    exerciseId: 'real-exercise-id',
    ...overrides,
  })

  describe('getActiveExerciseContext validation', () => {
    it('allows tool call with matching exerciseId', () => {
      expect(() => {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'real-exercise-id' },
          createContext(),
        )
      }).not.toThrow()
    })

    it('rejects tool call with mismatched exerciseId', () => {
      expect(() => {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'other-exercise-id' },
          createContext(),
        )
      }).toThrow('exerciseId mismatch')
    })

    it('rejects tool call without exerciseId in arguments', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', {}, createContext())
      }).toThrow('requires exerciseId')
    })

    it('rejects tool call with non-string exerciseId', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', { exerciseId: 123 }, createContext())
      }).toThrow('requires exerciseId')
    })

    it('rejects tool call without exerciseId in request context', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', { exerciseId: 'ex-123' }, {})
      }).toThrow('No active exercise')
    })

    it('rejects tool call with empty string exerciseId in arguments', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', { exerciseId: '' }, createContext())
      }).toThrow('requires exerciseId')
    })
  })

  describe('disallowed tool names', () => {
    it('rejects findCourses tool name', () => {
      expect(() => {
        validateStudentToolArgs('findCourses', { exerciseId: 'ex-123' }, createContext())
      }).toThrow('Tool not allowed for students')
    })

    it('rejects findExercises tool name', () => {
      expect(() => {
        validateStudentToolArgs('findExercises', { exerciseId: 'ex-123' }, createContext())
      }).toThrow('Tool not allowed for students')
    })

    it('rejects createCourses tool name', () => {
      expect(() => {
        validateStudentToolArgs('createCourses', { exerciseId: 'ex-123' }, createContext())
      }).toThrow('Tool not allowed for students')
    })

    it('rejects unknown tool names', () => {
      expect(() => {
        validateStudentToolArgs('someRandomTool', { exerciseId: 'ex-123' }, createContext())
      }).toThrow('Tool not allowed for students')
    })
  })

  describe('error messages', () => {
    it('includes both exercise IDs in mismatch error', () => {
      try {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'other-id' },
          createContext({ exerciseId: 'real-id' }),
        )
        throw new Error('Should have thrown')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        expect(message).toContain('other-id')
        expect(message).toContain('real-id')
      }
    })

    it('includes tool name in disallowed tool error', () => {
      try {
        validateStudentToolArgs('findCourses', { exerciseId: 'ex-123' }, createContext())
        throw new Error('Should have thrown')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        expect(message).toContain('findCourses')
      }
    })
  })

  describe('edge cases', () => {
    it('handles tool with additional args', () => {
      expect(() => {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'real-exercise-id', activeBlockId: 'block-1', extra: 'ignored' },
          createContext(),
        )
      }).not.toThrow()
    })

    it('handles context without user (guest)', () => {
      expect(() => {
        validateStudentToolArgs('getActiveExerciseContext', { exerciseId: 'ex-123' }, {})
      }).toThrow('No active exercise')
    })

    it('handles undefined exerciseId in context', () => {
      expect(() => {
        validateStudentToolArgs(
          'getActiveExerciseContext',
          { exerciseId: 'ex-123' },
          { exerciseId: undefined },
        )
      }).toThrow('No active exercise')
    })
  })
})
