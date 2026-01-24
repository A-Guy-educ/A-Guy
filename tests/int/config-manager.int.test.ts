// @vitest-environment node
/**
 * Config Manager Integration Tests
 *
 * @fileType integration-test
 * @domain config
 * @pattern key-value-store, encryption, audit-log
 * @ai-summary Integration tests for config manager functionality
 */

import { ConfigKind } from '@/lib/config/config-constants'
import { decryptSecret, encryptSecret } from '@/lib/config/config-crypto'
import type { User } from '@/payload-types'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// Test data
const TEST_ADMIN_EMAIL = 'config-test-admin@example.com'
const TEST_ADMIN_PASSWORD = 'test-password-min-32-chars!!'

describe('Config Manager', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let adminUser: User

  beforeAll(async () => {
    payload = await getPayload({ config })

    // Create or find admin user for tests
    try {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      if (users.docs.length > 0) {
        adminUser = users.docs[0]
      } else {
        adminUser = await payload.create({
          collection: 'users',
          data: {
            email: TEST_ADMIN_EMAIL,
            password: TEST_ADMIN_PASSWORD,
            role: 'admin',
          },
        })
      }
    } catch {
      // User might already exist, try to find
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      adminUser = users.docs[0]
    }
  })

  afterAll(async () => {
    // Cleanup test data
    try {
      await payload.delete({
        collection: 'config_entries',
        where: { key: { like: 'test_' } },
      })
      await payload.delete({
        collection: 'config_audit_logs',
        where: { key: { like: 'test_' } },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('ConfigEntries Collection', () => {
    test('should create variable config entry', async () => {
      const result = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_variable',
          kind: ConfigKind.Variable,
          value: 'plaintext-value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      expect(result.key).toBe('test_variable')
      expect(result.kind).toBe(ConfigKind.Variable)
      expect(result.value).toBe('plaintext-value')
      expect(result.enabled).toBe(true)
    })

    test('should create secret config entry with encryption', async () => {
      const secretValue = 'my-super-secret-password'

      const result = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_secret',
          kind: ConfigKind.Secret,
          value: secretValue,
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Value should be encrypted in DB (afterRead hook returns empty string)
      expect(result.value).toBe('') // Write-only UX
      expect(result.value).not.toBe(secretValue)

      // Verify encryption by using overrideAccess to bypass afterRead
      // Or directly query and decrypt
    })

    test('should reject duplicate key', async () => {
      await expect(
        payload.create({
          collection: 'config_entries',
          data: {
            key: 'test_variable', // Already exists from previous test
            kind: ConfigKind.Variable,
            value: 'another-value',
            enabled: true,
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow()
    })

    test('should reject non-snake_case key', async () => {
      await expect(
        payload.create({
          collection: 'config_entries',
          data: {
            key: 'Invalid-Key-Format',
            kind: ConfigKind.Variable,
            value: 'value',
            enabled: true,
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/snake_case/)
    })

    test('should reject key change on update', async () => {
      // First create a config entry
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_immutable',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Try to update key
      await expect(
        payload.update({
          collection: 'config_entries',
          id: created.id,
          data: { key: 'new_key' },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/cannot be changed/)
    })

    test('should reject kind change on update', async () => {
      // First create a config entry
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_kind_immutable',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Try to update kind
      await expect(
        payload.update({
          collection: 'config_entries',
          id: created.id,
          data: { kind: ConfigKind.Secret },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/cannot be changed/)
    })

    test('should update enabled without sending key or kind', async () => {
      // First create a config entry
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_update_enabled_only',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Update only enabled (no key or kind)
      const updated = await payload.update({
        collection: 'config_entries',
        id: created.id,
        data: { enabled: false },
        req: { user: adminUser } as any,
      })

      expect(updated.enabled).toBe(false)
    })

    test('should update value without sending key or kind', async () => {
      // First create a config entry
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_update_value_only',
          kind: ConfigKind.Variable,
          value: 'original',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Update only value (no key or kind)
      const updated = await payload.update({
        collection: 'config_entries',
        id: created.id,
        data: { value: 'updated' },
        req: { user: adminUser } as any,
      })

      expect(updated.value).toBe('updated')
    })

    test('should toggle enabled status', async () => {
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_toggle',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      const disabled = await payload.update({
        collection: 'config_entries',
        id: created.id,
        data: { enabled: false },
        req: { user: adminUser } as any,
      })

      expect(disabled.enabled).toBe(false)

      const reenabled = await payload.update({
        collection: 'config_entries',
        id: created.id,
        data: { enabled: true },
        req: { user: adminUser } as any,
      })

      expect(reenabled.enabled).toBe(true)
    })
  })

  describe('Encryption', () => {
    test('encrypt produces encrypted output', () => {
      const plaintext = 'secret-data'
      const encrypted = encryptSecret(plaintext)

      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted).not.toBe(plaintext)
    })

    test('round-trip preserves data', () => {
      const testValues = [
        'simple',
        'with spaces',
        'special-chars!@#$%',
        'unicode: עברית',
        'multi\nline',
      ]

      for (const value of testValues) {
        const encrypted = encryptSecret(value)
        const decrypted = decryptSecret(encrypted)
        expect(decrypted).toBe(value)
      }
    })
  })

  describe('ConfigAuditLogs Collection', () => {
    test('should create audit log on create', async () => {
      await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_audit_create',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      const logs = await payload.find({
        collection: 'config_audit_logs',
        where: { key: { equals: 'test_audit_create' } },
        sort: '-createdAt',
        limit: 1,
      })

      expect(logs.docs.length).toBeGreaterThan(0)
      expect(logs.docs[0].action).toBe('created')
      expect(logs.docs[0].actor).toBe(adminUser.id)
    })

    test('should create audit log on update', async () => {
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_audit_update',
          kind: ConfigKind.Variable,
          value: 'original',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      await payload.update({
        collection: 'config_entries',
        id: created.id,
        data: { value: 'updated' },
        req: { user: adminUser } as any,
      })

      const logs = await payload.find({
        collection: 'config_audit_logs',
        where: { key: { equals: 'test_audit_update' } },
        sort: '-createdAt',
      })

      const updateLog = logs.docs.find((log) => log.action === 'updated')
      expect(updateLog).toBeDefined()
    })

    test('should create audit log on enable/disable', async () => {
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_audit_toggle',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      await payload.update({
        collection: 'config_entries',
        id: created.id,
        data: { enabled: false },
        req: { user: adminUser } as any,
      })

      const logs = await payload.find({
        collection: 'config_audit_logs',
        where: { key: { equals: 'test_audit_toggle' } },
        sort: '-createdAt',
      })

      const disableLog = logs.docs.find((log) => log.action === 'disabled')
      expect(disableLog).toBeDefined()
    })

    test('should not store secret values in audit log', async () => {
      const secretValue = 'super-secret-audit-test'

      await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_audit_secret',
          kind: ConfigKind.Secret,
          value: secretValue,
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      const logs = await payload.find({
        collection: 'config_audit_logs',
        where: { key: { equals: 'test_audit_secret' } },
      })

      expect(logs.docs.length).toBeGreaterThan(0)
      // Audit log should NOT contain the secret value
      const logJson = JSON.stringify(logs.docs)
      expect(logJson).not.toContain(secretValue)
      expect(logJson).not.toContain('super-secret')
    })
  })

  describe('Admin UI Write-Only Behavior', () => {
    test('should return empty value for secret after save', async () => {
      const secretValue = 'ui-secret-test'

      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_ui_secret',
          kind: ConfigKind.Secret,
          value: secretValue,
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // AfterRead hook should return empty string for secrets
      expect(created.value).toBe('')

      // Fetch again - should still be empty
      const fetched = await payload.findByID({
        collection: 'config_entries',
        id: created.id,
        req: { user: adminUser } as any,
      })

      expect(fetched.value).toBe('')
    })

    test('should return plaintext value for variable after save', async () => {
      const variableValue = 'ui-variable-test'

      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_ui_variable',
          kind: ConfigKind.Variable,
          value: variableValue,
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Variables should return plaintext
      expect(created.value).toBe(variableValue)
    })

    test('encrypted value should still exist in database', async () => {
      const secretValue = 'db-encryption-test'

      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_db_encryption',
          kind: ConfigKind.Secret,
          value: secretValue,
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // The afterRead hook returns empty, but we need to verify
      // the encrypted value is still in the DB
      // We can verify this by checking the raw document
      // or by using a server-side function that bypasses afterRead

      // For testing: use find with overrideAccess to bypass hooks
      const rawDocs = await payload.find({
        collection: 'config_entries',
        where: { key: { equals: 'test_db_encryption' } },
        overrideAccess: true, // Bypass afterRead hook
        req: { user: adminUser } as any,
      })

      expect(rawDocs.docs[0].value).not.toBe(secretValue)
      expect(rawDocs.docs[0].value).not.toBe('')

      // Verify it can be decrypted
      const decrypted = decryptSecret(rawDocs.docs[0].value)
      expect(decrypted).toBe(secretValue)
    })
  })

  describe('Audit Collection Access', () => {
    test('should block direct create to audit logs', async () => {
      // This should fail because create: () => false
      await expect(
        payload.create({
          collection: 'config_audit_logs',
          data: {
            key: 'direct_create_test',
            kind: ConfigKind.Variable,
            action: 'created',
            actor: adminUser.id,
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow()
    })

    test('should allow hook to create audit entries via overrideAccess', async () => {
      // Create a config entry - the hook should create an audit log
      const created = await payload.create({
        collection: 'config_entries',
        data: {
          key: 'test_hook_override_access',
          kind: ConfigKind.Variable,
          value: 'value',
          enabled: true,
        },
        req: { user: adminUser } as any,
      })

      // Verify audit log was created (hook used overrideAccess)
      const logs = await payload.find({
        collection: 'config_audit_logs',
        where: { key: { equals: 'test_hook_override_access' } },
      })

      expect(logs.docs.length).toBeGreaterThan(0)
      expect(logs.docs[0].action).toBe('created')
    })
  })
})
