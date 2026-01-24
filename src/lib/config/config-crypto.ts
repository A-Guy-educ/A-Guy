/**
 * Config Encryption Utility
 *
 * @fileType utility
 * @domain config
 * @pattern encryption
 * @ai-summary AES-256-GCM encryption for config secrets
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

/**
 * Derive a 32-byte key from CONFIG_MASTER_KEY
 * Throws if env var is not set
 */
function getKey(): Buffer {
  const key = process.env.CONFIG_MASTER_KEY
  if (!key || key.length < 32) {
    throw new Error(
      'CONFIG_MASTER_KEY environment variable must be set and be at least 32 characters',
    )
  }
  return createHash('sha256').update(key).digest()
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Encrypt a plain text secret using AES-256-GCM.
 * Returns: iv + authTag + ciphertext (base64 encoded)
 *
 * @param plain - Plain text to encrypt
 * @returns Base64 encoded encrypted value
 * @throws Error if encryption fails
 */
export function encryptSecret(plain: string): string {
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
 *
 * @param encrypted - Base64 encoded encrypted value
 * @returns Decrypted plain text
 * @throws Error if decryption fails (wrong key or corrupted data)
 */
export function decryptSecret(encrypted: string): string {
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
