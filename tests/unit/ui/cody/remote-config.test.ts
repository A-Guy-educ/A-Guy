/**
 * Unit tests for remote-config module
 *
 * Tests parsing of REMOTE_DEV_USERS env var and helper functions.
 * Note: Since the module is evaluated once, we re-import it with mocked env vars.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('remote-config', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns undefined when REMOTE_DEV_USERS is not set', async () => {
    vi.stubEnv('REMOTE_DEV_USERS', '')
    const { getRemoteConfig, isRemoteEnabled, getAllRemoteUsers } =
      await import('@/ui/cody/remote-config')

    expect(getRemoteConfig('alice')).toBeUndefined()
    expect(isRemoteEnabled('alice')).toBe(false)
    expect(getAllRemoteUsers()).toEqual([])
  })

  it('parses a single user correctly', async () => {
    vi.stubEnv('REMOTE_DEV_USERS', 'alice:secret123:https://alice.ts.net')
    const { getRemoteConfig, isRemoteEnabled } = await import('@/ui/cody/remote-config')

    const config = getRemoteConfig('alice')
    expect(config).toBeDefined()
    expect(config?.ghUsername).toBe('alice')
    expect(config?.key).toBe('secret123')
    expect(config?.funnelUrl).toBe('https://alice.ts.net')
    expect(isRemoteEnabled('alice')).toBe(true)
  })

  it('parses multiple users comma-separated', async () => {
    vi.stubEnv('REMOTE_DEV_USERS', 'alice:key1:https://alice.ts.net,bob:key2:https://bob.ts.net')
    const { getRemoteConfig, getAllRemoteUsers } = await import('@/ui/cody/remote-config')

    expect(getRemoteConfig('alice')?.key).toBe('key1')
    expect(getRemoteConfig('bob')?.key).toBe('key2')

    const all = getAllRemoteUsers()
    expect(all).toHaveLength(2)
    // Keys should not be exposed
    expect(all[0]).not.toHaveProperty('key')
  })

  it('is case-insensitive for GitHub usernames', async () => {
    vi.stubEnv('REMOTE_DEV_USERS', 'Alice:secret:https://alice.ts.net')
    const { getRemoteConfig, isRemoteEnabled } = await import('@/ui/cody/remote-config')

    expect(getRemoteConfig('alice')).toBeDefined()
    expect(getRemoteConfig('ALICE')).toBeDefined()
    expect(isRemoteEnabled('alice')).toBe(true)
  })

  it('skips malformed entries', async () => {
    vi.stubEnv('REMOTE_DEV_USERS', 'bad-entry,alice:key:https://alice.ts.net')
    const { getRemoteConfig, getAllRemoteUsers } = await import('@/ui/cody/remote-config')

    // Only the valid entry should be parsed
    expect(getAllRemoteUsers()).toHaveLength(1)
    expect(getRemoteConfig('alice')).toBeDefined()
  })
})
