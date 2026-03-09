import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { encrypt, decrypt, generateSecret } from '@/infra/auth/oauth_crypto'

describe('Google OAuth Integration', () => {
  let payload: Payload

  beforeAll(async () => {
    // Ensure PAYLOAD_SECRET is set for crypto operations
    if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32) {
      process.env.PAYLOAD_SECRET = 'test-secret-key-for-integration-tests-only-minimum-32-chars'
    }
    payload = await getPayload({ config })
  })

  describe('OAuth Crypto Utilities', () => {
    it('encrypts and decrypts secrets correctly', () => {
      const plainSecret = 'test-secret-12345'
      const encrypted = encrypt(plainSecret)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plainSecret)
      expect(encrypted).not.toBe(plainSecret)
    })

    it('generates unique secrets', () => {
      const secret1 = generateSecret()
      const secret2 = generateSecret()

      expect(secret1).not.toBe(secret2)
      expect(secret1.length).toBeGreaterThan(0)
      expect(secret2.length).toBeGreaterThan(0)
    })

    it('throws error when PAYLOAD_SECRET is missing', () => {
      const originalSecret = process.env.PAYLOAD_SECRET
      process.env.PAYLOAD_SECRET = ''

      expect(() => encrypt('test')).toThrow('PAYLOAD_SECRET is required')

      process.env.PAYLOAD_SECRET = originalSecret
    })

    it('works with any length PAYLOAD_SECRET (due to SHA-256 hashing)', () => {
      const originalSecret = process.env.PAYLOAD_SECRET

      // Even short secrets work because SHA-256 produces fixed 32-byte output
      process.env.PAYLOAD_SECRET = 'short'
      const encrypted = encrypt('test')
      expect(encrypted).toBeDefined()

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('test')

      process.env.PAYLOAD_SECRET = originalSecret
    })
  })

  describe('OAuth User Creation', () => {
    it('creates user with OAuth fields', async () => {
      const testEmail = `oauth-test-${Date.now()}@example.com`
      const plainSecret = generateSecret()
      const encryptedSecret = encrypt(plainSecret)

      // @ts-expect-error - Payload type inference issue with OAuth fields
      const user = await payload.create({
        collection: 'users',
        data: {
          email: testEmail,
          googleSub: `google-sub-${Date.now()}`,
          verifiedEmail: testEmail,
          registeredAt: new Date().toISOString(),
          registrationMethod: 'google',
          googleProfile: {
            name: 'Test OAuth User',
          },
          name: 'Test OAuth User',
          password: plainSecret,
          oauthLoginSecretEnc: encryptedSecret,
        },
      })

      expect(user.id).toBeDefined()
      expect(user.email).toBe(testEmail)
      expect(user.googleSub).toBeDefined()
      expect(user.registrationMethod).toBe('google')
      expect(user.verifiedEmail).toBe(testEmail)

      // Cleanup
      await payload.delete({ collection: 'users', id: user.id })
    })

    it('enforces unique googleSub constraint', async () => {
      const googleSub = `unique-sub-${Date.now()}`
      const plainSecret = generateSecret()
      const encryptedSecret = encrypt(plainSecret)

      // Create first user
      // @ts-expect-error - Payload type inference issue
      const user1 = await payload.create({
        collection: 'users',
        data: {
          email: `user1-${Date.now()}@example.com`,
          googleSub,
          verifiedEmail: `user1-${Date.now()}@example.com`,
          registrationMethod: 'google',
          name: 'User 1',
          password: plainSecret,
          oauthLoginSecretEnc: encryptedSecret,
        },
      })

      // Try to create second user with same googleSub

      await expect(
        payload.create({
          collection: 'users',
          data: {
            email: `user2-${Date.now()}@example.com`,
            googleSub, // Same googleSub - should fail
            verifiedEmail: `user2-${Date.now()}@example.com`,
            registrationMethod: 'google',
            name: 'User 2',
            password: plainSecret,
            oauthLoginSecretEnc: encryptedSecret,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
      ).rejects.toThrow()

      // Cleanup
      await payload.delete({ collection: 'users', id: user1.id })
    })
  })

  describe('OAuth User Lookup', () => {
    it('finds user by googleSub', async () => {
      const googleSub = `lookup-test-${Date.now()}`
      const plainSecret = generateSecret()
      const encryptedSecret = encrypt(plainSecret)

      // @ts-expect-error - Payload type inference issue
      const createdUser = await payload.create({
        collection: 'users',
        data: {
          email: `lookup-${Date.now()}@example.com`,
          googleSub,
          verifiedEmail: `lookup-${Date.now()}@example.com`,
          registrationMethod: 'google',
          name: 'Lookup Test',
          password: plainSecret,
          oauthLoginSecretEnc: encryptedSecret,
        },
      })

      const foundUsers = await payload.find({
        collection: 'users',
        where: { googleSub: { equals: googleSub } },
        limit: 1,
        overrideAccess: true,
      })

      expect(foundUsers.docs.length).toBe(1)
      expect(foundUsers.docs[0].id).toBe(createdUser.id)
      expect(foundUsers.docs[0].googleSub).toBe(googleSub)

      // Cleanup
      await payload.delete({ collection: 'users', id: createdUser.id })
    })

    it('detects email collision', async () => {
      const sharedEmail = `collision-${Date.now()}@example.com`
      const plainSecret = generateSecret()

      // Create email/password user first

      const emailUser = (await payload.create({
        collection: 'users',
        data: {
          email: sharedEmail,
          name: 'Email User',
          password: plainSecret,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as any

      // Check for collision (simulating OAuth callback logic)
      const existingByEmail = await payload.find({
        collection: 'users',
        where: { email: { equals: sharedEmail } },
        limit: 1,
      })

      expect(existingByEmail.docs.length).toBe(1)
      expect(existingByEmail.docs[0].googleSub).toBeUndefined()

      // This would trigger collision handling in OAuth callback
      expect(existingByEmail.docs[0].id).toBe(emailUser.id)

      // Cleanup
      await payload.delete({ collection: 'users', id: emailUser.id })
    })

    it('links Google account to existing email/password user (keeps both login methods)', async () => {
      const sharedEmail = `linking-${Date.now()}@example.com`
      const emailPassword = 'original-password-123'
      const googleSub = `google-link-${Date.now()}`

      // Create email/password user first
      const emailUser = (await payload.create({
        collection: 'users',
        data: {
          email: sharedEmail,
          name: 'Email User',
          password: emailPassword,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as any

      expect(emailUser.googleSub).toBeUndefined()

      // Simulate OAuth callback linking (without replacing password)
      const updatedUser = (await payload.update({
        collection: 'users',
        id: emailUser.id,
        data: {
          googleSub,
          // NOTE: We do NOT update password or oauthLoginSecretEnc
          // This allows both login methods to work
          googleProfile: {
            name: 'Google User',
          },
          verifiedEmail: sharedEmail,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as any

      // Verify linking succeeded
      expect(updatedUser.googleSub).toBe(googleSub)
      expect(updatedUser.email).toBe(sharedEmail)
      expect(updatedUser.googleProfile?.name).toBe('Google User')

      // Verify original email/password login STILL works
      const emailLogin = await payload.login({
        collection: 'users',
        data: { email: sharedEmail, password: emailPassword },
      })
      expect(emailLogin.token).toBeDefined()
      expect(emailLogin.user.id).toBe(emailUser.id)

      // Verify we can generate a session token for Google login (simulating OAuth callback)
      // For linked accounts, we generate tokens directly without password check
      const { SignJWT } = await import('jose')
      const secret = process.env.PAYLOAD_SECRET!
      const secretKey = new TextEncoder().encode(secret)
      const issuedAt = Math.floor(Date.now() / 1000)
      const tokenExpiration = 7200
      const exp = issuedAt + tokenExpiration

      const token = await new SignJWT({
        id: updatedUser.id,
        email: updatedUser.email,
        collection: 'users',
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt(issuedAt)
        .setExpirationTime(exp)
        .sign(secretKey)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      // Cleanup
      await payload.delete({ collection: 'users', id: emailUser.id })
    })
  })

  describe('OAuth Session Login', () => {
    it('allows login with encrypted secret', async () => {
      const testEmail = `session-test-${Date.now()}@example.com`
      const plainSecret = generateSecret()
      const encryptedSecret = encrypt(plainSecret)

      const user = (await payload.create({
        collection: 'users',
        data: {
          email: testEmail,
          googleSub: `session-sub-${Date.now()}`,
          verifiedEmail: testEmail,
          registrationMethod: 'google',
          name: 'Session Test',
          password: plainSecret,
          oauthLoginSecretEnc: encryptedSecret,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as any

      // Decrypt and login (simulating OAuth callback)
      const decryptedSecret = decrypt(encryptedSecret)
      const loginResult = await payload.login({
        collection: 'users',
        data: { email: testEmail, password: decryptedSecret },
      })

      expect(loginResult.token).toBeDefined()
      expect(loginResult.user.id).toBe(user.id)

      // Cleanup
      await payload.delete({ collection: 'users', id: user.id })
    })
  })

  afterAll(async () => {
    // Close DB connection to prevent connection leaks
    if (payload?.db?.destroy) {
      await payload.db.destroy()
    }
  })
})
