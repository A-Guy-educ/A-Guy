import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import { execFileSync } from 'child_process'

vi.mock('fs')
vi.mock('child_process')

import {
  JsonStateStore,
  GhVariableStateStore,
  createStateStore,
} from '../../../../scripts/inspector/core/state'

describe('JsonStateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return undefined for missing keys', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const store = new JsonStateStore('/tmp/test.json')
    expect(store.get('missing')).toBeUndefined()
  })

  it('should load existing state from disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('{"system:cycleNumber": 42}')
    const store = new JsonStateStore('/tmp/test.json')
    expect(store.get<number>('system:cycleNumber')).toBe(42)
  })

  it('should set and get values', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const store = new JsonStateStore('/tmp/test.json')
    store.set('key', 'value')
    expect(store.get('key')).toBe('value')
  })

  it('should save dirty state to disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
    vi.mocked(fs.renameSync).mockReturnValue(undefined)

    const store = new JsonStateStore('/tmp/test.json')
    store.set('key', 'value')
    store.save()

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/test.json.tmp',
      expect.stringContaining('"key"'),
      'utf-8',
    )
    expect(fs.renameSync).toHaveBeenCalledWith('/tmp/test.json.tmp', '/tmp/test.json')
  })

  it('should not save when not dirty', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const store = new JsonStateStore('/tmp/test.json')
    store.save()
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })
})

describe('GhVariableStateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load state from gh variable', () => {
    vi.mocked(execFileSync).mockReturnValue('{"system:cycleNumber": 5}')
    const store = new GhVariableStateStore('owner/repo')
    expect(store.get<number>('system:cycleNumber')).toBe(5)
  })

  it('should start fresh when variable does not exist', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('variable not found')
    })
    const store = new GhVariableStateStore('owner/repo')
    expect(store.get<number>('system:cycleNumber')).toBeUndefined()
  })

  it('should increment cycle number across saves', () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('{"system:cycleNumber": 5}') // load
      .mockReturnValueOnce('') // save

    const store = new GhVariableStateStore('owner/repo')
    const current = store.get<number>('system:cycleNumber') || 0
    store.set('system:cycleNumber', current + 1)
    store.save()

    expect(execFileSync).toHaveBeenCalledTimes(2)
    const saveCall = vi.mocked(execFileSync).mock.calls[1]
    expect(saveCall[0]).toBe('gh')
    expect(saveCall[1]).toContain('set')
    expect(saveCall[1]).toContain('INSPECTOR_STATE')

    // Verify the saved JSON contains the incremented cycle
    const bodyArg = (saveCall[1] as string[]).find((_, i, arr) => arr[i - 1] === '--body')
    expect(bodyArg).toBeDefined()
    const parsed = JSON.parse(bodyArg!)
    expect(parsed['system:cycleNumber']).toBe(6)
  })

  it('should not crash when save fails', () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce('{}') // load succeeds
      .mockImplementationOnce(() => {
        throw new Error('network error')
      }) // save fails

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new GhVariableStateStore('owner/repo')
    store.set('key', 'value')

    // Should not throw
    expect(() => store.save()).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save state'))
    consoleSpy.mockRestore()
  })
})

describe('createStateStore', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('should return GhVariableStateStore in GitHub Actions', () => {
    process.env = { ...originalEnv, GITHUB_ACTIONS: 'true' }
    vi.mocked(execFileSync).mockReturnValue('{}')

    const store = createStateStore('owner/repo', '/tmp/test.json')
    expect(store).toBeInstanceOf(GhVariableStateStore)
  })

  it('should return JsonStateStore when not in GitHub Actions', () => {
    process.env = { ...originalEnv }
    delete process.env.GITHUB_ACTIONS
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const store = createStateStore('owner/repo', '/tmp/test.json')
    expect(store).toBeInstanceOf(JsonStateStore)
  })
})
