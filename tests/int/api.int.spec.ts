import { startMongoContainer, stopMongoContainer } from '@/utilities/test/mongodb-container'
import { getPayload, Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let originalDatabaseUrl: string | undefined

describe('API', () => {
  beforeAll(
    async () => {
      // Save original DATABASE_URL and unset it before starting testcontainers
      // (testcontainers will fail if DATABASE_URL is set to Atlas)
      originalDatabaseUrl = process.env.DATABASE_URL
      // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
      delete process.env.DATABASE_URL

      // Start MongoDB test container and set DATABASE_URL to testcontainers URL
      const mongoUri = await startMongoContainer()
      process.env.DATABASE_URL = mongoUri

      // Import config AFTER setting DATABASE_URL so it uses the test database
      // The config reads process.env.DATABASE_URL at evaluation time
      const config = await import('@payload-config')

      // Initialize Payload with the test MongoDB
      // testcontainers waits for MongoDB to be ready before start() resolves
      payload = await getPayload({ config: config.default })
    },
    120000, // 120 second timeout (MongoDB container startup + Payload init can be slow)
  )

  afterAll(async () => {
    // Restore original DATABASE_URL if it was set
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl
    } else {
      // Remove the property if it wasn't originally set
      // @ts-expect-error - TypeScript doesn't allow delete on process.env, but it's safe here
      delete process.env.DATABASE_URL
    }

    // Stop MongoDB container
    await stopMongoContainer()
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
    expect(users.docs).toBeDefined()
    expect(Array.isArray(users.docs)).toBe(true)
  })
})
