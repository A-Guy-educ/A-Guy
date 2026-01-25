/**
 * OAuth Encryption Utility
 *
 * @fileType utility
 * @domain auth
 * @pattern encryption
 * @ai-summary AES-256-GCM encryption for OAuth login secrets
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// Derive a proper 32-byte key using SHA-256
// Note: SHA-256 produces a fixed 32-byte output regardless of input length,
// so any length PAYLOAD_SECRET will work (though longer is better for security)
function getKey(): Buffer {
  const ENC_KEY = process.env.PAYLOAD_SECRET
  if (!ENC_KEY) {
    throw new Error('PAYLOAD_SECRET is required')
  }
  return createHash('sha256').update(ENC_KEY).digest()
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Encrypt a plain text secret using AES-256-GCM.
 * Returns: iv + authTag + ciphertext (base64 encoded)
 */
export function encrypt(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cipher = createCipheriv(ALGORITHM, key as any, iv as any)

  let encrypted = cipher.update(plain, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  // Combine: iv + authTag + ciphertext

  const combined = Buffer.concat([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    iv as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authTag as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Buffer.from(encrypted, 'base64') as any,
  ])

  return combined.toString('base64')
}

/**
 * Decrypt an encrypted secret.
 * Format: iv + authTag + ciphertext (base64 encoded)
 */
export function decrypt(encrypted: string): string {
  const key = getKey()
  const combined = Buffer.from(encrypted, 'base64')

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decipher = createDecipheriv(ALGORITHM, key as any, iv as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decipher.setAuthTag(authTag as any)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let decrypted = decipher.update(ciphertext as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decrypted = Buffer.concat([decrypted as any, decipher.final() as any])

  return decrypted.toString('utf8')
}

/**
 * Generate a cryptographically secure random secret.
 */
export function generateSecret(): string {
  return randomBytes(32).toString('base64url')
}
