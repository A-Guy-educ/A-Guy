import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process.spawn before importing the module
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ pid: 12345 })),
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

  it('should call spawn with "pnpm exec opencode" and ["run", "--agent", stage, prompt]', () => {
    const runner = new GitHubRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write tests', env, '/my/project')

    expect(spawn).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'opencode', 'run', '--agent', 'spec', 'Write tests'],
      {
        cwd: '/my/project',
        stdio: 'inherit',
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
      ['exec', 'opencode', 'run', '--agent', 'execute', 'Do the thing'],
      expect.objectContaining({ cwd: '/workspace/repo', stdio: 'inherit', env: {} }),
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
})

describe('LocalRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have name "opencode-local"', () => {
    const runner = new LocalRunner()
    expect(runner.name).toBe('opencode-local')
  })

  it('should call spawn with "pnpm" and --agent flag', () => {
    const runner = new LocalRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write a spec', env, '/my/project')

    expect(spawn).toHaveBeenCalledOnce()
    // Prompt is passed as positional argument after --agent
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['ocode', 'run', '--agent', 'spec', 'Write a spec'],
      expect.objectContaining({ cwd: '/my/project', stdio: 'inherit' }),
    )
  })

  it('should pass AGENT and MODEL in env vars', () => {
    const runner = new LocalRunner()
    const env = { MODEL: 'gpt-4' } as unknown as NodeJS.ProcessEnv

    runner.spawn('execute', 'Implement the feature', env, '/cwd')

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      AGENT: 'execute',
      MODEL: 'gpt-4',
    })
  })

  it('should pass MODEL env var through', () => {
    const runner = new LocalRunner()
    const env = { MODEL: 'gpt-4', OTHER: 'val' } as unknown as NodeJS.ProcessEnv

    runner.spawn('verify', 'Check', env, '/cwd')

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({ MODEL: 'gpt-4' })
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
