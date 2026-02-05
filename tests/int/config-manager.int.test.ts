// @vitest-environment node
/**
 * Config Manager Integration Tests
 *
 * @fileType integration-test
 * @domain config
 * @pattern key-value-store, encryption, audit-log, tenant-scoped
 * @ai-summary Integration tests for tenant-scoped config secrets functionality
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Test file requires any for PayloadRequest typing */

import { decryptSecret, encryptSecret } from '@/infra/config/config-crypto'
import type { Tenant, User } from '@/payload-types'
import config from '@payload-config'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// Test data
const TEST_ADMIN_EMAIL = 'config-test-admin@example.com'
const TEST_ADMIN_PASSWORD = 'test-password-min-32-chars!!'
const TEST_TENANT_1_SLUG = 'config-test-tenant-1'
const TEST_TENANT_2_SLUG = 'config-test-tenant-2'

describe('Config Secrets (Tenant-Scoped)', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>
  let adminUser: User
  let tenant1: Tenant
  let tenant2: Tenant

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
            tier: 'free',
          },
        })
      }
    } catch {
      const users = await payload.find({
        collection: 'users',
        where: { email: { equals: TEST_ADMIN_EMAIL } },
      })
      adminUser = users.docs[0]
    }

    // Create or find test tenant 1
    const tenants1 = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_1_SLUG } },
    })
    if (tenants1.docs.length > 0) {
      tenant1 = tenants1.docs[0]
    } else {
      tenant1 = await payload.create({
        collection: 'tenants',
        data: { name: 'Config Test Tenant 1', slug: TEST_TENANT_1_SLUG },
        overrideAccess: true,
      })
    }

    // Create or find test tenant 2
    const tenants2 = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: TEST_TENANT_2_SLUG } },
    })
    if (tenants2.docs.length > 0) {
      tenant2 = tenants2.docs[0]
    } else {
      tenant2 = await payload.create({
        collection: 'tenants',
        data: { name: 'Config Test Tenant 2', slug: TEST_TENANT_2_SLUG },
        overrideAccess: true,
      })
    }
  })

  afterAll(async () => {
    // Cleanup test data with tenant filter
    try {
      const testTenantIds = [tenant1.id, tenant2.id]
      await payload.delete({
        collection: 'config_secrets',
        where: {
          and: [{ key: { like: 'test_' } }, { tenant: { in: testTenantIds } }],
        },
      })
      await payload.delete({
        collection: 'config_audit_logs',
        where: {
          and: [{ key: { like: 'test_' } }, { tenant: { in: testTenantIds } }],
        },
      })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('ConfigSecrets Collection (Tenant-Scoped)', () => {
    test('should create secret config entry with encryption', async () => {
      const secretValue = 'my-super-secret-password'

      const result = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_secret',
          value: secretValue,
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      // Value should be encrypted in DB (afterRead hook returns empty string)
      expect(result.value).toBe('') // Write-only UX
      expect(result.value).not.toBe(secretValue)
    })

    test('should allow same key under different tenants', async () => {
      const result1 = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'shared_key',
          value: 'tenant-1-value',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      const result2 = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'shared_key',
          value: 'tenant-2-value',
          enabled: true,
          tenant: tenant2.id,
        },
        req: { user: adminUser } as any,
      })

      expect(result1.id).not.toBe(result2.id)
      expect(result1.tenant).toBe(tenant1.id)
      expect(result2.tenant).toBe(tenant2.id)
    })

    test('should reject duplicate key in same tenant', async () => {
      // Create first entry
      await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'unique_key',
          value: 'value',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      // Try to create duplicate in same tenant
      await expect(
        payload.create({
          collection: 'config_secrets',
          draft: false,
          data: {
            key: 'unique_key', // Same key
            value: 'value',
            enabled: true,
            tenant: tenant1.id, // Same tenant
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/already exists for this tenant/)
    })

    test('should reject non-snake_case key', async () => {
      await expect(
        payload.create({
          collection: 'config_secrets',
          draft: false,
          data: {
            key: 'Invalid-Key-Format',
            value: 'value',
            enabled: true,
            tenant: tenant1.id,
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/snake_case/)
    })

    test('should reject key change on update', async () => {
      const created = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_immutable',
          value: 'value',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      await expect(
        payload.update({
          collection: 'config_secrets',
          id: created.id,
          data: { key: 'new_key' },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow(/cannot be changed/)
    })

    test('should update enabled without sending key', async () => {
      const created = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_update_enabled_only',
          value: 'value',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      const updated = await payload.update({
        collection: 'config_secrets',
        id: created.id,
        data: { enabled: false },
        req: { user: adminUser } as any,
      })

      expect(updated.enabled).toBe(false)
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

  describe('ConfigAuditLogs Collection (Tenant-Scoped)', () => {
    test('should create audit log on create with tenant', async () => {
      await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_audit_create',
          value: 'value',
          enabled: true,
          tenant: tenant1.id,
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
      expect(logs.docs[0].tenant).toBe(tenant1.id)
    })

    test('should create audit log on update', async () => {
      const created = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_audit_update',
          value: 'original',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      await payload.update({
        collection: 'config_secrets',
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
      expect(updateLog?.tenant).toBe(tenant1.id)
    })

    test('should create audit log on enable/disable', async () => {
      const created = await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_audit_toggle',
          value: 'value',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      await payload.update({
        collection: 'config_secrets',
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
      expect(disableLog?.tenant).toBe(tenant1.id)
    })

    test('should not store secret values in audit log', async () => {
      const secretValue = 'super-secret-audit-test'

      await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_audit_secret',
          value: secretValue,
          enabled: true,
          tenant: tenant1.id,
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
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_ui_secret',
          value: secretValue,
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      // AfterRead hook should return empty string for secrets
      expect(created.value).toBe('')

      const fetched = await payload.findByID({
        collection: 'config_secrets',
        id: created.id,
        req: { user: adminUser } as any,
      })

      expect(fetched.value).toBe('')
    })

    test('encrypted value should still exist in database', async () => {
      const secretValue = 'db-encryption-test'

      await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_db_encryption',
          value: secretValue,
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      // For testing: use find with overrideAccess to bypass hooks
      const rawDocs = await payload.find({
        collection: 'config_secrets',
        where: { key: { equals: 'test_db_encryption' } },
        overrideAccess: true,
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
      await expect(
        payload.create({
          collection: 'config_audit_logs',
          draft: false,
          data: {
            key: 'direct_create_test',
            action: 'created',
            actor: adminUser.id,
            tenant: tenant1.id,
          },
          req: { user: adminUser } as any,
        }),
      ).rejects.toThrow()
    })

    test('should allow hook to create audit entries via overrideAccess', async () => {
      await payload.create({
        collection: 'config_secrets',
        draft: false,
        data: {
          key: 'test_hook_override_access',
          value: 'value',
          enabled: true,
          tenant: tenant1.id,
        },
        req: { user: adminUser } as any,
      })

      const logs = await payload.find({
        collection: 'config_audit_logs',
        where: { key: { equals: 'test_hook_override_access' } },
      })

      expect(logs.docs.length).toBeGreaterThan(0)
      expect(logs.docs[0].action).toBe('created')
    })
  })
})
