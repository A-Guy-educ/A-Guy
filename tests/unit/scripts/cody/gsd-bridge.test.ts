/**
 * @fileType test
 * @domain cody | gsd
 * @ai-summary Tests for GSD config bridge — complexity-to-config mapping and file operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

import {
  resolveGsdConfig,
  writeGsdConfig,
  cleanGsdState,
  prepareGsdEnvironment,
} from '../../../../scripts/cody/gsd-bridge'

describe('gsd-bridge', () => {
  // ============================================================
  // resolveGsdConfig — complexity tier mapping
  // ============================================================
  describe('resolveGsdConfig', () => {
    it('always sets mode to yolo', () => {
      for (const c of [1, 10, 25, 40, 70]) {
        expect(resolveGsdConfig(c).mode).toBe('yolo')
      }
    })

    it('always sets commit_docs to false', () => {
      for (const c of [1, 10, 25, 40, 70]) {
        expect(resolveGsdConfig(c).commit_docs).toBe(false)
      }
    })

    it('always sets auto_advance and _auto_chain_active', () => {
      for (const c of [1, 10, 25, 40, 70]) {
        expect(resolveGsdConfig(c).workflow.auto_advance).toBe(true)
        expect(resolveGsdConfig(c).workflow._auto_chain_active).toBe(true)
      }
    })

    // Trivial tier (1-9)
    it('trivial tier (complexity 5): all workflow flags off, balanced profile', () => {
      const config = resolveGsdConfig(5)
      expect(config.model_profile).toBe('balanced')
      expect(config.workflow.research).toBe(false)
      expect(config.workflow.plan_check).toBe(false)
      expect(config.workflow.nyquist_validation).toBe(false)
    })

    it('boundary: complexity 9 is still trivial', () => {
      const config = resolveGsdConfig(9)
      expect(config.workflow.research).toBe(false)
      expect(config.workflow.plan_check).toBe(false)
      expect(config.workflow.nyquist_validation).toBe(false)
    })

    // Simple tier (10-19)
    it('simple tier (complexity 15): plan_check off (below 20)', () => {
      const config = resolveGsdConfig(15)
      expect(config.model_profile).toBe('balanced')
      expect(config.workflow.research).toBe(false)
      expect(config.workflow.plan_check).toBe(false)
      expect(config.workflow.nyquist_validation).toBe(false)
    })

    it('boundary: complexity 10 transitions to simple', () => {
      const config = resolveGsdConfig(10)
      expect(config.workflow.research).toBe(false)
      expect(config.workflow.plan_check).toBe(false)
    })

    it('boundary: complexity 19 still simple', () => {
      const config = resolveGsdConfig(19)
      expect(config.workflow.plan_check).toBe(false)
    })

    // Moderate tier (20-34)
    it('moderate tier (complexity 25): plan_check on, research off', () => {
      const config = resolveGsdConfig(25)
      expect(config.model_profile).toBe('balanced')
      expect(config.workflow.research).toBe(false)
      expect(config.workflow.plan_check).toBe(true)
      expect(config.workflow.nyquist_validation).toBe(false)
    })

    it('boundary: complexity 20 transitions to moderate', () => {
      const config = resolveGsdConfig(20)
      expect(config.workflow.plan_check).toBe(true)
      expect(config.workflow.research).toBe(false)
    })

    it('boundary: complexity 34 still moderate', () => {
      const config = resolveGsdConfig(34)
      expect(config.workflow.research).toBe(false)
      expect(config.workflow.nyquist_validation).toBe(false)
    })

    // Complex tier (35-49)
    it('complex tier (complexity 40): all workflow flags on, balanced profile', () => {
      const config = resolveGsdConfig(40)
      expect(config.model_profile).toBe('balanced')
      expect(config.workflow.research).toBe(true)
      expect(config.workflow.plan_check).toBe(true)
      expect(config.workflow.nyquist_validation).toBe(true)
    })

    it('boundary: complexity 35 transitions to complex', () => {
      const config = resolveGsdConfig(35)
      expect(config.workflow.research).toBe(true)
      expect(config.workflow.nyquist_validation).toBe(true)
    })

    it('boundary: complexity 49 still complex/balanced', () => {
      const config = resolveGsdConfig(49)
      expect(config.model_profile).toBe('balanced')
    })

    // Very complex tier (50+)
    it('very complex tier (complexity 70): quality model profile', () => {
      const config = resolveGsdConfig(70)
      expect(config.model_profile).toBe('quality')
      expect(config.workflow.research).toBe(true)
      expect(config.workflow.plan_check).toBe(true)
      expect(config.workflow.nyquist_validation).toBe(true)
    })

    it('boundary: complexity 50 transitions to quality profile', () => {
      const config = resolveGsdConfig(50)
      expect(config.model_profile).toBe('quality')
    })

    it('extreme: complexity 100', () => {
      const config = resolveGsdConfig(100)
      expect(config.model_profile).toBe('quality')
      expect(config.workflow.research).toBe(true)
    })
  })

  // ============================================================
  // File operations
  // ============================================================
  describe('file operations', () => {
    let tmpDir: string

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-bridge-test-'))
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    describe('writeGsdConfig', () => {
      it('creates .planning/config.json with valid JSON', () => {
        const config = resolveGsdConfig(25)
        writeGsdConfig(tmpDir, config)

        const configPath = path.join(tmpDir, '.planning', 'config.json')
        expect(fs.existsSync(configPath)).toBe(true)

        const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        expect(written.mode).toBe('yolo')
        expect(written.commit_docs).toBe(false)
        expect(written.workflow.plan_check).toBe(true)
      })

      it('creates .planning/ directory if missing', () => {
        const planningDir = path.join(tmpDir, '.planning')
        expect(fs.existsSync(planningDir)).toBe(false)

        writeGsdConfig(tmpDir, resolveGsdConfig(10))
        expect(fs.existsSync(planningDir)).toBe(true)
      })

      it('overwrites existing config', () => {
        writeGsdConfig(tmpDir, resolveGsdConfig(10))
        writeGsdConfig(tmpDir, resolveGsdConfig(50))

        const configPath = path.join(tmpDir, '.planning', 'config.json')
        const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        expect(written.model_profile).toBe('quality')
      })
    })

    describe('cleanGsdState', () => {
      it('removes .planning/ directory', () => {
        const planningDir = path.join(tmpDir, '.planning')
        fs.mkdirSync(planningDir)
        fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State')

        cleanGsdState(tmpDir)
        expect(fs.existsSync(planningDir)).toBe(false)
      })

      it('does nothing if .planning/ does not exist', () => {
        expect(() => cleanGsdState(tmpDir)).not.toThrow()
      })
    })

    describe('prepareGsdEnvironment', () => {
      it('cleans previous state and writes fresh config', () => {
        // Write some old state
        const planningDir = path.join(tmpDir, '.planning')
        fs.mkdirSync(planningDir)
        fs.writeFileSync(path.join(planningDir, 'STATE.md'), 'old state')

        const config = prepareGsdEnvironment(tmpDir, 40)

        // Old STATE.md should be gone
        expect(fs.existsSync(path.join(planningDir, 'STATE.md'))).toBe(false)
        // New config.json should exist
        expect(fs.existsSync(path.join(planningDir, 'config.json'))).toBe(true)
        // Returned config should match
        expect(config.workflow.research).toBe(true)
        expect(config.model_profile).toBe('balanced')
      })

      it('returns the generated config', () => {
        const config = prepareGsdEnvironment(tmpDir, 70)
        expect(config.model_profile).toBe('quality')
        expect(config.workflow.research).toBe(true)
      })
    })
  })
})
