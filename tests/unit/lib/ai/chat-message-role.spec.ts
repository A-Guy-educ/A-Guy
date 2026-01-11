/**
 * Unit Tests for Chat Message Role Module
 *
 * Tests the ChatRole enum, type guards, parsers, and Gemini API converters.
 */
import { describe, expect, it } from 'vitest'
import {
  ChatMessageRole,
  ChatRole,
  fromGeminiRole,
  isChatMessageRole,
  isChatRole,
  parseChatRole,
  toGeminiRole,
} from '@/lib/ai/chat-message-role'

describe('ChatRole', () => {
  describe('enum values', () => {
    it('should have User value as "user"', () => {
      expect(ChatRole.User).toBe('user')
    })

    it('should have Assistant value as "assistant"', () => {
      expect(ChatRole.Assistant).toBe('assistant')
    })
  })

  describe('isChatRole', () => {
    it('should return true for ChatRole.User', () => {
      expect(isChatRole(ChatRole.User)).toBe(true)
    })

    it('should return true for ChatRole.Assistant', () => {
      expect(isChatRole(ChatRole.Assistant)).toBe(true)
    })

    it('should return true for string "user"', () => {
      expect(isChatRole('user')).toBe(true)
    })

    it('should return true for string "assistant"', () => {
      expect(isChatRole('assistant')).toBe(true)
    })

    it('should return false for null', () => {
      expect(isChatRole(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isChatRole(undefined)).toBe(false)
    })

    it('should return false for invalid string "model"', () => {
      expect(isChatRole('model')).toBe(false)
    })

    it('should return false for invalid string "system"', () => {
      expect(isChatRole('system')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isChatRole('')).toBe(false)
    })

    it('should return false for number', () => {
      expect(isChatRole(123)).toBe(false)
    })

    it('should return false for object', () => {
      expect(isChatRole({})).toBe(false)
    })

    it('should return false for array', () => {
      expect(isChatRole([])).toBe(false)
    })

    it('should return false for boolean', () => {
      expect(isChatRole(true)).toBe(false)
    })
  })

  describe('parseChatRole', () => {
    it('should parse valid "user" string', () => {
      expect(parseChatRole('user')).toBe(ChatRole.User)
    })

    it('should parse valid "assistant" string', () => {
      expect(parseChatRole('assistant')).toBe(ChatRole.Assistant)
    })

    it('should parse ChatRole.User enum value', () => {
      expect(parseChatRole(ChatRole.User)).toBe(ChatRole.User)
    })

    it('should parse ChatRole.Assistant enum value', () => {
      expect(parseChatRole(ChatRole.Assistant)).toBe(ChatRole.Assistant)
    })

    it('should throw error for invalid value "model"', () => {
      expect(() => parseChatRole('model')).toThrow('Invalid chat role: model')
    })

    it('should throw error for null', () => {
      expect(() => parseChatRole(null)).toThrow('Invalid chat role: null')
    })

    it('should throw error for undefined', () => {
      expect(() => parseChatRole(undefined)).toThrow('Invalid chat role: undefined')
    })

    it('should throw error for number', () => {
      expect(() => parseChatRole(123)).toThrow('Invalid chat role: 123')
    })

    it('should throw error for empty string', () => {
      expect(() => parseChatRole('')).toThrow('Invalid chat role: ')
    })

    it('should throw error for object', () => {
      expect(() => parseChatRole({})).toThrow('Invalid chat role: [object Object]')
    })

    it('should include the invalid value in error message', () => {
      const invalidValue = 'invalid-role'
      try {
        parseChatRole(invalidValue)
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain(invalidValue)
      }
    })
  })

  describe('toGeminiRole', () => {
    it('should convert ChatRole.User to "user"', () => {
      expect(toGeminiRole(ChatRole.User)).toBe('user')
    })

    it('should convert ChatRole.Assistant to "model"', () => {
      expect(toGeminiRole(ChatRole.Assistant)).toBe('model')
    })
  })

  describe('fromGeminiRole', () => {
    it('should convert "user" to ChatRole.User', () => {
      expect(fromGeminiRole('user')).toBe(ChatRole.User)
    })

    it('should convert "model" to ChatRole.Assistant', () => {
      expect(fromGeminiRole('model')).toBe(ChatRole.Assistant)
    })
  })

  describe('backward compatibility', () => {
    it('should expose ChatMessageRole as alias for ChatRole', () => {
      expect(ChatMessageRole).toBe(ChatRole)
      expect(ChatMessageRole.User).toBe(ChatRole.User)
      expect(ChatMessageRole.Assistant).toBe(ChatRole.Assistant)
    })

    it('should expose isChatMessageRole as alias for isChatRole', () => {
      expect(isChatMessageRole).toBe(isChatRole)
    })

    it('ChatMessageRole should work identically to ChatRole', () => {
      expect(isChatMessageRole(ChatMessageRole.User)).toBe(true)
      expect(isChatMessageRole(ChatMessageRole.Assistant)).toBe(true)
      expect(isChatMessageRole('user')).toBe(true)
      expect(isChatMessageRole('invalid')).toBe(false)
    })
  })

  describe('type narrowing', () => {
    it('should narrow type correctly with isChatRole', () => {
      const value: unknown = 'user'

      if (isChatRole(value)) {
        // TypeScript should now know value is ChatRole
        const role: ChatRole = value
        expect(role).toBe(ChatRole.User)
      } else {
        // Should not reach here
        expect(true).toBe(false)
      }
    })

    it('should not narrow type for invalid values', () => {
      const value: unknown = 'invalid'

      if (isChatRole(value)) {
        // Should not reach here
        expect(true).toBe(false)
      } else {
        // Value is still unknown
        expect(typeof value).toBe('string')
      }
    })
  })

  describe('edge cases', () => {
    it('should handle case-sensitive comparison', () => {
      expect(isChatRole('User')).toBe(false) // Capital U
      expect(isChatRole('ASSISTANT')).toBe(false) // All caps
      expect(isChatRole('Assistant')).toBe(false) // Capital A
    })

    it('should handle whitespace correctly', () => {
      expect(isChatRole(' user')).toBe(false)
      expect(isChatRole('user ')).toBe(false)
      expect(isChatRole(' user ')).toBe(false)
    })

    it('should handle special characters', () => {
      expect(isChatRole('user\n')).toBe(false)
      expect(isChatRole('user\t')).toBe(false)
    })
  })
})
