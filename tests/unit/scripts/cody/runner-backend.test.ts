import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process.spawn before importing the module
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ pid: 12345 })),
}))

// Mock opencode-server to control resolveOpenCodeBinary return value
vi.mock('../../../../scripts/cody/opencode-server', () => ({
  resolveOpenCodeBinary: vi.fn(() => '/mock/opencode'),
}))

import { spawn } from 'child_process'
import { GitHubRunner, LocalRunner, createRunner } from '../../../../scripts/cody/runner-backend'
import { resetEnv } from '../../../../scripts/cody/env'

describe('GitHubRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have name "opencode-github"', () => {
    const runner = new GitHubRunner()
    expect(runner.name).toBe('opencode-github')
  })

  it('should call spawn with "pnpm exec opencode" when no serverUrl', () => {
    const runner = new GitHubRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write tests', env, '/my/project')

    expect(spawn).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'opencode', 'run', '--agent', 'spec', '--format', 'json', 'Write tests'],
      {
        cwd: '/my/project',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: '/usr/bin' },
      },
    )
  })

  it('should pass cwd correctly', () => {
    const runner = new GitHubRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('execute', 'Do the thing', env, '/workspace/repo')

    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'opencode', 'run', '--agent', 'execute', '--format', 'json', 'Do the thing'],
      expect.objectContaining({
        cwd: '/workspace/repo',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {},
      }),
    )
  })

  it('should pass env vars through unchanged', () => {
    const runner = new GitHubRunner()
    const env = { EXISTING: 'value', MODEL: 'gpt-4' } as unknown as NodeJS.ProcessEnv

    runner.spawn('verify', 'Check results', env, '/cwd')

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      EXISTING: 'value',
      MODEL: 'gpt-4',
    })
  })

  it('should use resolveOpenCodeBinary with --attach and --dir when serverUrl is provided', () => {
    const runner = new GitHubRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', { serverUrl: 'http://127.0.0.1:4097' })

    // Server mode: spawn resolved opencode binary (not pnpm exec)
    expect(spawn).toHaveBeenCalledWith('/mock/opencode', expect.any(Array), expect.any(Object))
    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(args).toContain('--attach')
    expect(args).toContain('http://127.0.0.1:4097')
    expect(args).toContain('--dir')
    expect(args).toContain('/cwd')
    // --attach should come before prompt
    const attachIdx = args.indexOf('--attach')
    const promptIdx = args.indexOf('Build it')
    expect(attachIdx).toBeLessThan(promptIdx)
  })

  it('should add --session and --fork flags when sessionId is provided', () => {
    const runner = new GitHubRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('review', 'Review code', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
      sessionId: 'sess-abc-123',
    })

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(args).toContain('--session')
    expect(args).toContain('sess-abc-123')
    expect(args).toContain('--fork')
  })

  it('should use pnpm exec when no serverUrl (backward compat)', () => {
    const runner = new GitHubRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write spec', env, '/cwd', {})

    expect(spawn).toHaveBeenCalledWith('pnpm', expect.any(Array), expect.any(Object))
    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(args).not.toContain('--attach')
    expect(args).not.toContain('--session')
    expect(args).not.toContain('--fork')
  })

  it('should set XDG_DATA_HOME in env when dataDir is provided (server mode)', () => {
    const runner = new GitHubRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
      dataDir: '/tasks/123/opencode-data',
    })

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      XDG_DATA_HOME: '/tasks/123/opencode-data',
    })
  })

  it('should NOT set XDG_DATA_HOME when no dataDir (server mode)', () => {
    const runner = new GitHubRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
    })

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).not.toHaveProperty('XDG_DATA_HOME')
  })

  it('should NOT set XDG_DATA_HOME without serverUrl (backward compat)', () => {
    const runner = new GitHubRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write spec', env, '/cwd')

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).not.toHaveProperty('XDG_DATA_HOME')
  })
})

describe('LocalRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have name "opencode-local"', () => {
    const runner = new LocalRunner()
    expect(runner.name).toBe('opencode-local')
  })

  it('should call spawn with "pnpm ocode" when no serverUrl', () => {
    const runner = new LocalRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write a spec', env, '/my/project')

    expect(spawn).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['ocode', 'run', '--agent', 'spec', '--format', 'json', 'Write a spec'],
      expect.objectContaining({ cwd: '/my/project', stdio: ['ignore', 'pipe', 'pipe'] }),
    )
  })

  it('should pass AGENT and MODEL in env vars (non-server mode)', () => {
    const runner = new LocalRunner()
    const env = { MODEL: 'gpt-4' } as unknown as NodeJS.ProcessEnv

    runner.spawn('execute', 'Implement the feature', env, '/cwd')

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      AGENT: 'execute',
      MODEL: 'gpt-4',
    })
  })

  it('should pass cwd correctly', () => {
    const runner = new LocalRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('spec', 'prompt', env, '/workspace/repo')

    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      expect.any(Array),
      expect.objectContaining({ cwd: '/workspace/repo' }),
    )
  })

  it('should use resolveOpenCodeBinary with --attach and --dir when serverUrl is provided', () => {
    const runner = new LocalRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', { serverUrl: 'http://127.0.0.1:4097' })

    // Server mode: spawn resolved opencode binary (not pnpm ocode)
    expect(spawn).toHaveBeenCalledWith('/mock/opencode', expect.any(Array), expect.any(Object))
    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(args).toContain('--attach')
    expect(args).toContain('http://127.0.0.1:4097')
    expect(args).toContain('--dir')
    expect(args).toContain('/cwd')
  })

  it('should add --session and --fork flags when sessionId is provided', () => {
    const runner = new LocalRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('review', 'Review code', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
      sessionId: 'sess-abc-123',
    })

    const args = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(args).toContain('--session')
    expect(args).toContain('sess-abc-123')
    expect(args).toContain('--fork')
  })

  it('should set XDG_DATA_HOME in env when dataDir is provided (server mode)', () => {
    const runner = new LocalRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
      dataDir: '/tasks/456/opencode-data',
    })

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      XDG_DATA_HOME: '/tasks/456/opencode-data',
    })
  })

  it('should NOT set XDG_DATA_HOME when no dataDir (server mode)', () => {
    const runner = new LocalRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
    })

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).not.toHaveProperty('XDG_DATA_HOME')
  })

  it('should include AGENT and MODEL in server mode env', () => {
    const runner = new LocalRunner()
    const env = { MODEL: 'claude-4' } as unknown as NodeJS.ProcessEnv

    runner.spawn('build', 'Build it', env, '/cwd', {
      serverUrl: 'http://127.0.0.1:4097',
      dataDir: '/tasks/456/opencode-data',
    })

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      AGENT: 'build',
      MODEL: 'claude-4',
      XDG_DATA_HOME: '/tasks/456/opencode-data',
    })
  })
})

describe('createRunner', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    // Reset env cache so tests can set environment variables
    resetEnv()
  })

  afterEach(() => {
    process.env = originalEnv
    resetEnv()
  })

  it('should return LocalRunner when local=true', () => {
    const runner = createRunner(true)
    expect(runner).toBeInstanceOf(LocalRunner)
    expect(runner.name).toBe('opencode-local')
  })

  it('should return GitHubRunner when local=false', () => {
    const runner = createRunner(false)
    expect(runner).toBeInstanceOf(GitHubRunner)
    expect(runner.name).toBe('opencode-github')
  })

  it('should return GitHubRunner when GITHUB_ACTIONS is set and local is undefined', () => {
    process.env.GITHUB_ACTIONS = 'true'

    const runner = createRunner()
    expect(runner).toBeInstanceOf(GitHubRunner)
    expect(runner.name).toBe('opencode-github')
  })

  it('should return LocalRunner when GITHUB_ACTIONS is not set and local is undefined', () => {
    delete process.env.GITHUB_ACTIONS

    const runner = createRunner()
    expect(runner).toBeInstanceOf(LocalRunner)
    expect(runner.name).toBe('opencode-local')
  })
})
