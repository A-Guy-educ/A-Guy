/**
 * @fileType test
 * @domain inspector
 * @ai-summary Verifies the consolidation: watchdog + supervisor removed, inspector has all capabilities
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const projectRoot = process.cwd()

describe('Monitoring consolidation', () => {
  describe('removed systems', () => {
    it('should not have watchdog directory', () => {
      expect(existsSync(join(projectRoot, 'scripts/watchdog'))).toBe(false)
    })

    it('should not have supervisor directory', () => {
      expect(existsSync(join(projectRoot, 'scripts/supervisor'))).toBe(false)
    })

    it('should not have watchdog workflow', () => {
      expect(existsSync(join(projectRoot, '.github/workflows/watchdog.yml'))).toBe(false)
    })

    it('should not have supervisor workflow', () => {
      expect(existsSync(join(projectRoot, '.github/workflows/supervisor.yml'))).toBe(false)
    })

    it('should not have parse-safety-supervisor.sh', () => {
      expect(existsSync(join(projectRoot, 'scripts/cody/parse-safety-supervisor.sh'))).toBe(false)
    })

    it('should not have parse-safety-supervisor.ts', () => {
      expect(existsSync(join(projectRoot, 'scripts/cody/parse-safety-supervisor.ts'))).toBe(false)
    })

    it('should not have supervisor script in package.json', () => {
      const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))
      expect(pkg.scripts.supervisor).toBeUndefined()
    })
  })

  describe('inspector has required capabilities', () => {
    it('should have health-check plugin', () => {
      expect(
        existsSync(join(projectRoot, 'scripts/inspector/plugins/cody/health-check/index.ts')),
      ).toBe(true)
    })

    it('should have failure-analysis plugin', () => {
      expect(
        existsSync(join(projectRoot, 'scripts/inspector/plugins/cody/failure-analysis/index.ts')),
      ).toBe(true)
    })

    it('should have classifier (from supervisor)', () => {
      expect(
        existsSync(
          join(projectRoot, 'scripts/inspector/plugins/cody/failure-analysis/classifier.ts'),
        ),
      ).toBe(true)
    })

    it('should have analyzer (from supervisor)', () => {
      expect(
        existsSync(
          join(projectRoot, 'scripts/inspector/plugins/cody/failure-analysis/analyzer.ts'),
        ),
      ).toBe(true)
    })

    it('should have stage-router (from supervisor)', () => {
      expect(
        existsSync(
          join(projectRoot, 'scripts/inspector/plugins/cody/failure-analysis/stage-router.ts'),
        ),
      ).toBe(true)
    })

    it('should have Slack client (from watchdog)', () => {
      expect(existsSync(join(projectRoot, 'scripts/inspector/clients/slack.ts'))).toBe(true)
    })

    it('should have audit plugin', () => {
      expect(existsSync(join(projectRoot, 'scripts/inspector/plugins/cody/audit/index.ts'))).toBe(
        true,
      )
    })

    it('should register failure-analysis plugin in entry point', async () => {
      const entryContent = readFileSync(join(projectRoot, 'scripts/inspector/index.ts'), 'utf-8')
      expect(entryContent).toContain('failureAnalysisPlugin')
      expect(entryContent).toContain('registry.register(failureAnalysisPlugin)')
    })
  })
})
