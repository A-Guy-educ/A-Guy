/**
 * Unit Tests for Error Handling Utilities
 *
 * Tests the handlePayloadError function for parsing Payload CMS errors.
 */
import { describe, expect, it } from 'vitest'
import { handlePayloadError } from '@/server/errors'

describe('handlePayloadError', () => {
  describe('with valid Payload errors', () => {
    it('should parse single field error', () => {
      // Arrange
      const error = {
        data: {
          errors: [{ path: 'email', message: 'Email is required' }],
        },
      }
      const fallbackMessage = 'Validation failed'

      // Act
      const result = handlePayloadError(error, fallbackMessage)

      // Assert
      expect(result).not.toBeNull()
      expect(result).toEqual({
        success: false,
        message: 'Validation failed',
        errors: {
          email: 'Email is required',
        },
      })
    })

    it('should parse multiple field errors', () => {
      // Arrange
      const error = {
        data: {
          errors: [
            { path: 'email', message: 'Email is required' },
            { path: 'password', message: 'Password must be at least 8 characters' },
            { path: 'username', message: 'Username is already taken' },
          ],
        },
      }
      const fallbackMessage = 'Validation failed'

      // Act
      const result = handlePayloadError(error, fallbackMessage)

      // Assert
      expect(result).not.toBeNull()
      expect(result).toEqual({
        success: false,
        message: 'Validation failed',
        errors: {
          email: 'Email is required',
          password: 'Password must be at least 8 characters',
          username: 'Username is already taken',
        },
      })
    })

    it('should extract error paths and messages correctly', () => {
      // Arrange
      const error = {
        data: {
          errors: [
            { path: 'user.profile.age', message: 'Age must be a positive number' },
            { path: 'settings.notifications', message: 'Invalid notification settings' },
          ],
        },
      }
      const fallbackMessage = 'Invalid input'

      // Act
      const result = handlePayloadError(error, fallbackMessage)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.errors).toHaveProperty('user.profile.age')
      expect(result?.errors).toHaveProperty('settings.notifications')
      expect(result?.errors?.['user.profile.age']).toBe('Age must be a positive number')
      expect(result?.errors?.['settings.notifications']).toBe('Invalid notification settings')
    })

    it('should use fallback message provided', () => {
      // Arrange
      const error = {
        data: {
          errors: [{ path: 'field', message: 'Error message' }],
        },
      }
      const fallbackMessage = 'Custom error message'

      // Act
      const result = handlePayloadError(error, fallbackMessage)

      // Assert
      expect(result?.message).toBe('Custom error message')
    })

    it('should return correct ErrorResult structure', () => {
      // Arrange
      const error = {
        data: {
          errors: [{ path: 'name', message: 'Name is required' }],
        },
      }

      // Act
      const result = handlePayloadError(error, 'Error')

      // Assert
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(result).toHaveProperty('errors')
      expect(result?.success).toBe(false)
    })
  })

  describe('with invalid inputs', () => {
    it('should return null for non-object errors', () => {
      expect(handlePayloadError('string error', 'Fallback')).toBeNull()
      expect(handlePayloadError(123, 'Fallback')).toBeNull()
      expect(handlePayloadError(true, 'Fallback')).toBeNull()
    })

    it('should return null for errors without data property', () => {
      const error = {
        message: 'Some error',
        status: 400,
      }
      expect(handlePayloadError(error, 'Fallback')).toBeNull()
    })

    it('should return null for errors with no field errors', () => {
      const error = {
        data: {
          message: 'General error',
        },
      }
      expect(handlePayloadError(error, 'Fallback')).toBeNull()
    })

    it('should return null for empty errors array', () => {
      const error = {
        data: {
          errors: [],
        },
      }
      expect(handlePayloadError(error, 'Fallback')).toBeNull()
    })

    it('should return null for null input', () => {
      expect(handlePayloadError(null, 'Fallback')).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(handlePayloadError(undefined, 'Fallback')).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle malformed error objects gracefully', () => {
      const error = {
        data: {
          errors: 'not an array',
        },
      }
      expect(handlePayloadError(error, 'Fallback')).toBeNull()
    })

    it('should handle errors with missing path field', () => {
      const error = {
        data: {
          errors: [
            { path: 'email', message: 'Email error' },
            { message: 'No path field' }, // Missing path
            { path: 'password', message: 'Password error' },
          ],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      // Should only include errors with both path and message
      expect(result).not.toBeNull()
      expect(result?.errors).toHaveProperty('email')
      expect(result?.errors).toHaveProperty('password')
      expect(Object.keys(result?.errors || {})).toHaveLength(2)
    })

    it('should handle errors with missing message field', () => {
      const error = {
        data: {
          errors: [
            { path: 'email', message: 'Email error' },
            { path: 'username' }, // Missing message
            { path: 'password', message: 'Password error' },
          ],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      // Should only include errors with both path and message
      expect(result).not.toBeNull()
      expect(result?.errors).toHaveProperty('email')
      expect(result?.errors).toHaveProperty('password')
      expect(Object.keys(result?.errors || {})).toHaveLength(2)
    })

    it('should handle errors with empty path', () => {
      const error = {
        data: {
          errors: [
            { path: '', message: 'Empty path message' },
            { path: 'valid', message: 'Valid message' },
          ],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      // Should include valid error and filter out empty path
      expect(result).not.toBeNull()
      expect(result?.errors).toHaveProperty('valid')
      expect(Object.keys(result?.errors || {})).toHaveLength(1)
    })

    it('should return null when only empty paths exist', () => {
      const error = {
        data: {
          errors: [{ path: '', message: 'Empty path message' }],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      // No valid errors, should return null
      expect(result).toBeNull()
    })

    it('should handle errors with empty message', () => {
      const error = {
        data: {
          errors: [
            { path: 'field', message: '' },
            { path: 'valid', message: 'Valid message' },
          ],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      // Should include valid error and filter out empty message
      expect(result).not.toBeNull()
      expect(result?.errors).toHaveProperty('valid')
      expect(Object.keys(result?.errors || {})).toHaveLength(1)
    })

    it('should return null when only empty messages exist', () => {
      const error = {
        data: {
          errors: [{ path: 'field', message: '' }],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      // No valid errors, should return null
      expect(result).toBeNull()
    })

    it('should handle duplicate paths by using last occurrence', () => {
      const error = {
        data: {
          errors: [
            { path: 'email', message: 'First error' },
            { path: 'email', message: 'Second error' },
            { path: 'email', message: 'Third error' },
          ],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      expect(result).not.toBeNull()
      expect(result?.errors?.email).toBe('Third error')
      expect(Object.keys(result?.errors || {})).toHaveLength(1)
    })

    it('should handle errors with extra properties', () => {
      const error = {
        data: {
          errors: [
            {
              path: 'email',
              message: 'Email error',
              code: 'INVALID_EMAIL',
              extra: 'ignored',
            },
          ],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      expect(result).not.toBeNull()
      expect(result?.errors?.email).toBe('Email error')
    })

    it('should verify fallback message is used correctly', () => {
      const error = {
        data: {
          errors: [{ path: 'field', message: 'Field error' }],
        },
      }

      const result1 = handlePayloadError(error, 'Message A')
      const result2 = handlePayloadError(error, 'Message B')
      const result3 = handlePayloadError(error, '')

      expect(result1?.message).toBe('Message A')
      expect(result2?.message).toBe('Message B')
      expect(result3?.message).toBe('')
    })
  })

  describe('type safety', () => {
    it('should handle errors with any type correctly', () => {
      const error: any = {
        data: {
          errors: [{ path: 'test', message: 'Test message' }],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      expect(result).not.toBeNull()
      expect(result?.errors?.test).toBe('Test message')
    })

    it('should handle unknown type correctly', () => {
      const error: unknown = {
        data: {
          errors: [{ path: 'test', message: 'Test message' }],
        },
      }

      const result = handlePayloadError(error, 'Fallback')

      expect(result).not.toBeNull()
      expect(result?.errors?.test).toBe('Test message')
    })
  })
})
