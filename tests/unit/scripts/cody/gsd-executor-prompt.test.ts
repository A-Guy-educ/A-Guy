/**
 * @fileType test
 * @domain cody | gsd
 * @ai-summary Validates local gsd-executor override disables git commits and preserves essential sections
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('gsd-executor local override', () => {
  const executorPath = path.resolve(__dirname, '../../../../.opencode/agents/gsd-executor.md')
  let content: string

  it('file exists at .opencode/agents/gsd-executor.md', () => {
    expect(fs.existsSync(executorPath)).toBe(true)
    content = fs.readFileSync(executorPath, 'utf-8')
  })

  it('contains explicit "Do NOT make git commits" instruction', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('Do NOT make git commits')
  })

  it('does NOT contain git commit instructions', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    // Should not have the task_commit_protocol or final_commit sections
    expect(content).not.toContain('<task_commit_protocol>')
    expect(content).not.toContain('<final_commit>')
    expect(content).not.toContain('git commit -m')
    expect(content).not.toContain('git add src/')
  })

  it('does NOT contain self_check git verification', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).not.toContain('<self_check>')
    expect(content).not.toContain('git log --oneline --all | grep')
  })

  it('does NOT contain state_updates section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).not.toContain('<state_updates>')
    expect(content).not.toContain('state advance-plan')
  })

  it('preserves execution_flow section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<execution_flow>')
  })

  it('preserves deviation_rules section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<deviation_rules>')
  })

  it('preserves tdd_execution section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<tdd_execution>')
  })

  it('preserves checkpoint_protocol section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<checkpoint_protocol>')
  })

  it('preserves summary_creation section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<summary_creation>')
  })

  it('preserves analysis_paralysis_guard section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<analysis_paralysis_guard>')
  })

  it('preserves completion_format section', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('<completion_format>')
  })

  it('success criteria includes NO git commits requirement', () => {
    content = fs.readFileSync(executorPath, 'utf-8')
    expect(content).toContain('NO git commits made')
  })
})
