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
    expect(workflow.on.schedule[0].cron).toBe('0 2 * * *') // Daily at 2 AM UTC
  })

  it('should allow manual trigger', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    expect(workflow.on.workflow_dispatch).toBeDefined()
  })

  it('should use production environment', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')
    const workflow = yaml.parse(content)

    expect(workflow.jobs.cleanup.environment.name).toBe('production')
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
    const runScript = cleanupStep.run

    // Verify it uses GitHub secrets
    expect(runScript).toContain('secrets.CRON_ENDPOINT')
    expect(runScript).toContain('secrets.CRON_SECRET')
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

  it('should document required secrets in comments', async () => {
    const content = await fs.readFile(workflowPath, 'utf-8')

    // Should have documentation about required secrets
    expect(content).toContain('CRON_ENDPOINT')
    expect(content).toContain('CRON_SECRET')
    expect(content).toContain('Config_entries')
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
