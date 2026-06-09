import { describe, expect, it } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import yaml from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
}

describe('Media Cleanup GitHub Workflow', () => {
  const workflowPath = path.resolve(process.cwd(), '.github/workflows/media-cleanup.yml')

  it('should exist', async () => {
    const exists = await fs
      .access(workflowPath)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(true)
  })

  it('should be valid YAML', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    expect(() => yaml.parse(content)).not.toThrow()
  })

  it('should have correct schedule configuration', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    expect(workflow.on.schedule).toBeDefined()
    expect(workflow.on.schedule).toHaveLength(1)
    expect(workflow.on.schedule[0].cron).toBe('0 4 * * *') // Daily at 4 AM UTC
  })

  it('should allow manual trigger', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    expect(workflow.on.workflow_dispatch).toBeDefined()
  })

  it('should use vars for CRON_ENDPOINT and secrets for CRON_SECRET', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    // CRON_ENDPOINT is a URL (not a secret) — stored as a repository variable
    // CRON_SECRET is a secret — stored as a repository secret
    expect(workflow.jobs.cleanup.env.CRON_ENDPOINT).toBe('${{ vars.CRON_ENDPOINT }}')
    expect(workflow.jobs.cleanup.env.CRON_SECRET).toBe('${{ secrets.CRON_SECRET }}')
  })

  it('should call correct endpoint with authentication', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    const cleanupStep = workflow.jobs.cleanup.steps.find(
      (step: WorkflowStep) => step.name === 'Call cleanup endpoint',
    )
    expect(cleanupStep).toBeDefined()

    const runScript = cleanupStep.run
    expect(runScript).toContain('/api/cron/media-expiry')
    expect(runScript).toContain('Authorization: Bearer')
    expect(runScript).toContain('Content-Type: application/json')
  })

  it('should use required secrets', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    const cleanupStep = workflow.jobs.cleanup.steps.find(
      (step: WorkflowStep) => step.name === 'Call cleanup endpoint',
    )

    // Secrets/vars must be passed via job-level env block (not hardcoded in run script).
    // CRON_ENDPOINT is a repository variable (URL is not a secret).
    // CRON_SECRET is a repository secret.
    expect(workflow.jobs.cleanup.env).toBeDefined()
    expect(workflow.jobs.cleanup.env.CRON_ENDPOINT).toBe('${{ vars.CRON_ENDPOINT }}')
    expect(workflow.jobs.cleanup.env.CRON_SECRET).toBe('${{ secrets.CRON_SECRET }}')

    // Run script should reference the env vars (shell variables).
    const runScript = cleanupStep.run
    expect(runScript).toContain('$CRON_ENDPOINT')
    expect(runScript).toContain('$CRON_SECRET')
  })

  it('should handle HTTP errors', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    const cleanupStep = workflow.jobs.cleanup.steps.find(
      (step: WorkflowStep) => step.name === 'Call cleanup endpoint',
    )
    const runScript = cleanupStep.run

    // Should check HTTP status code and exit on failure
    expect(runScript).toContain('http_code')
    expect(runScript).toContain('exit 1')
  })

  it('should document required vars and secrets in comments', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')

    // Should have documentation about required vars and secrets
    expect(content).toContain('CRON_ENDPOINT')
    expect(content).toContain('CRON_SECRET')
    expect(content).toContain('GitHub Variables')
    expect(content).toContain('GitHub Secrets')
  })

  it('should send POST request', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    const cleanupStep = workflow.jobs.cleanup.steps.find(
      (step: WorkflowStep) => step.name === 'Call cleanup endpoint',
    )
    const runScript = cleanupStep.run

    expect(runScript).toContain('-X POST')
  })
})
