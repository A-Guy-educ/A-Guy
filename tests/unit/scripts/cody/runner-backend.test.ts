import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock child_process.spawn before importing the module
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({ pid: 12345 })),
}))

import { spawn } from 'child_process'
import { GitHubRunner, LocalRunner, createRunner } from '../../../../scripts/cody/runner-backend'

describe('GitHubRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have name "opencode-github"', () => {
    const runner = new GitHubRunner()
    expect(runner.name).toBe('opencode-github')
  })

  it('should call spawn with "opencode" and ["github", "run"]', () => {
    const runner = new GitHubRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write tests', env, '/my/project')

    expect(spawn).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledWith('opencode', ['github', 'run'], {
      cwd: '/my/project',
      stdio: 'inherit',
      env: { PATH: '/usr/bin', AGENT: 'spec', PROMPT: 'Write tests' },
    })
  })

  it('should pass cwd correctly', () => {
    const runner = new GitHubRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('execute', 'Do the thing', env, '/workspace/repo')

    expect(spawn).toHaveBeenCalledWith(
      'opencode',
      ['github', 'run'],
      expect.objectContaining({ cwd: '/workspace/repo' }),
    )
  })

  it('should set AGENT and PROMPT env vars from arguments', () => {
    const runner = new GitHubRunner()
    const env = { EXISTING: 'value' } as unknown as NodeJS.ProcessEnv

    runner.spawn('verify', 'Check results', env, '/cwd')

    const calledEnv = vi.mocked(spawn).mock.calls[0][2]?.env
    expect(calledEnv).toMatchObject({
      EXISTING: 'value',
      AGENT: 'verify',
      PROMPT: 'Check results',
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

  it('should call spawn with "pnpm" and correct arguments including fullPrompt', () => {
    const runner = new LocalRunner()
    const env = { PATH: '/usr/bin' } as unknown as NodeJS.ProcessEnv

    runner.spawn('spec', 'Write a spec', env, '/my/project')

    expect(spawn).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledWith(
      'pnpm',
      ['ocode', 'run', '--agent', 'spec', 'Execute spec for this task. Write a spec'],
      expect.objectContaining({ cwd: '/my/project', stdio: 'inherit' }),
    )
  })

  it('should construct fullPrompt that includes stage name and original prompt', () => {
    const runner = new LocalRunner()
    const env = {} as NodeJS.ProcessEnv

    runner.spawn('execute', 'Implement the feature', env, '/cwd')

    const calledArgs = vi.mocked(spawn).mock.calls[0][1]
    const fullPrompt = calledArgs![calledArgs!.length - 1]
    expect(fullPrompt).toBe('Execute execute for this task. Implement the feature')
    expect(fullPrompt).toContain('execute')
    expect(fullPrompt).toContain('Implement the feature')
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
  })

  afterEach(() => {
    process.env = originalEnv
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
