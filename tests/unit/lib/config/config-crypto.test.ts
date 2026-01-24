/**
 * Config Crypto Unit Tests
 *
 * @fileType unit-test
 * @domain config
 * @pattern encryption
 * @ai-summary Unit tests for config encryption utilities
 */

import { decryptSecret, encryptSecret } from '@/lib/config/config-crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// Set test environment
const TEST_MASTER_KEY = 'test-master-key-32-characters-long!!'

describe('Config Crypto', () => {
  beforeAll(() => {
    process.env.CONFIG_MASTER_KEY = TEST_MASTER_KEY
  })

  afterAll(() => {
    delete process.env.CONFIG_MASTER_KEY
  })

  describe('encryptSecret', () => {
    test('should encrypt plaintext', () => {
      const plaintext = 'my-secret-value'
      const encrypted = encryptSecret(plaintext)

      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted).not.toBe(plaintext)
    })

    test('should produce base64 output', () => {
      const encrypted = encryptSecret('test')
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow()
    })

    test('should produce different output for same input (random IV)', () => {
      const plaintext = 'same-value'
      const encrypted1 = encryptSecret(plaintext)
      const encrypted2 = encryptSecret(plaintext)

      expect(encrypted1).not.toBe(encrypted2)
    })
  })

  describe('decryptSecret', () => {
    test('should decrypt encrypted value', () => {
      const plaintext = 'decrypt-me'
      const encrypted = encryptSecret(plaintext)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    test('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;\':",./<>?'
      const encrypted = encryptSecret(specialChars)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(specialChars)
    })

    test('should handle unicode', () => {
      const unicode = 'עברית 中文 日本語 🚀'
      const encrypted = encryptSecret(unicode)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(unicode)
    })

    test('should handle empty string', () => {
      const encrypted = encryptSecret('')
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe('')
    })

    test('should handle long strings', () => {
      const longString = 'a'.repeat(10000)
      const encrypted = encryptSecret(longString)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(longString)
    })

    test('should throw on invalid data', () => {
      expect(() => decryptSecret('not-encrypted')).toThrow()
    })

    test('should throw on tampered ciphertext', () => {
      const encrypted = encryptSecret('test')
      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -5) + 'xxxxx'
      expect(() => decryptSecret(tampered)).toThrow()
    })
  })
})
