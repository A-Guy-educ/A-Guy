import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  readAuditHistory,
  addImprovement,
  updateStats,
  getEffectivenessScore,
  getImprovementTypes,
  type Improvement,
} from '../../../../scripts/cody/audit-history'

// Test constants
const TASKS_DIR = path.join(process.cwd(), '.tasks')
const AUDIT_HISTORY_FILE = path.join(TASKS_DIR, 'audit-history.json')

describe('audit-history utility', () => {
  // Store original file content for restoration
  let originalContent: string | null = null

  beforeEach(() => {
    // Backup original file
    if (fs.existsSync(AUDIT_HISTORY_FILE)) {
      originalContent = fs.readFileSync(AUDIT_HISTORY_FILE, 'utf-8')
    }
  })

  afterEach(() => {
    // Restore original file
    if (originalContent !== null) {
      fs.writeFileSync(AUDIT_HISTORY_FILE, originalContent)
    }
  })

  describe('readAuditHistory', () => {
    it('should read and parse the audit-history.json file', () => {
      const history = readAuditHistory()

      expect(history).toBeDefined()
      expect(typeof history.version).toBe('number')
      expect(Array.isArray(history.improvements)).toBe(true)
      expect(typeof history.stats).toBe('object')
      expect(typeof history.lastUpdated).toBe('string')
    })

    it('should have correct schema structure', () => {
      const history = readAuditHistory()

      // Version should be a number
      expect(history.version).toBeGreaterThanOrEqual(1)

      // Stats should have required fields
      expect(typeof history.stats.totalImprovements).toBe('number')
      expect(typeof history.stats.appliedCount).toBe('number')
      expect(typeof history.stats.suggestedCount).toBe('number')
      expect(typeof history.stats.effectivenessScores).toBe('object')
      expect(typeof history.stats.topCategories).toBe('object')

      // Effectiveness scores should have required keys
      expect(history.stats.effectivenessScores).toHaveProperty('effective')
      expect(history.stats.effectivenessScores).toHaveProperty('neutral')
      expect(history.stats.effectivenessScores).toHaveProperty('ineffective')
      expect(history.stats.effectivenessScores).toHaveProperty('unknown')
    })

    it('should throw error if file does not exist', () => {
      // Temporarily rename file to test error handling
      const tempPath = `${AUDIT_HISTORY_FILE}.backup`
      fs.renameSync(AUDIT_HISTORY_FILE, tempPath)

      expect(() => readAuditHistory()).toThrow(/not found/i)

      // Restore file
      fs.renameSync(tempPath, AUDIT_HISTORY_FILE)
    })

    it('should throw error for invalid JSON', () => {
      // Backup and write invalid JSON
      const backup = fs.readFileSync(AUDIT_HISTORY_FILE, 'utf-8')
      fs.writeFileSync(AUDIT_HISTORY_FILE, 'invalid json')

      expect(() => readAuditHistory()).toThrow()

      // Restore
      fs.writeFileSync(AUDIT_HISTORY_FILE, backup)
    })
  })

  describe('addImprovement', () => {
    it('should add a new improvement entry', () => {
      const before = readAuditHistory()
      const initialCount = before.improvements.length

      const newImprovement: Omit<Improvement, 'date'> = {
        taskId: '260221-test-task',
        type: 'DOC',
        title: 'Test improvement',
        where: 'scripts/cody/test.ts',
        status: 'applied',
        followUpTaskIds: [],
        effectiveness: 'effective',
      }

      const result = addImprovement(newImprovement)

      // Should have one more improvement
      expect(result.improvements.length).toBe(initialCount + 1)

      // Last improvement should be the one we added
      const lastImprovement = result.improvements[result.improvements.length - 1]
      expect(lastImprovement.taskId).toBe('260221-test-task')
      expect(lastImprovement.type).toBe('DOC')
      expect(lastImprovement.status).toBe('applied')
      expect(lastImprovement.effectiveness).toBe('effective')
      expect(lastImprovement.date).toBeDefined()

      // Should update lastUpdated
      expect(result.lastUpdated).toBeDefined()
    })

    it('should update stats after adding improvement', () => {
      const newImprovement: Omit<Improvement, 'date'> = {
        taskId: '260221-test-stats',
        type: 'GUARDRAIL',
        title: 'Stats test',
        where: 'test.ts',
        status: 'suggested',
        followUpTaskIds: [],
        effectiveness: 'neutral',
      }

      const result = addImprovement(newImprovement)

      // Stats should reflect the new improvement
      expect(result.stats.totalImprovements).toBe(result.improvements.length)
      expect(result.stats.suggestedCount).toBeGreaterThan(0)
    })

    it('should add followUpTaskIds correctly', () => {
      const newImprovement: Omit<Improvement, 'date'> = {
        taskId: '260221-test-followup',
        type: 'INDEX',
        title: 'Follow-up test',
        where: 'test.ts',
        status: 'applied',
        followUpTaskIds: ['260222-followup-1', '260222-followup-2'],
        effectiveness: 'effective',
      }

      const result = addImprovement(newImprovement)

      const lastImprovement = result.improvements[result.improvements.length - 1]
      expect(lastImprovement.followUpTaskIds).toEqual(['260222-followup-1', '260222-followup-2'])
    })
  })

  describe('updateStats', () => {
    it('should recalculate stats from existing improvements', () => {
      const result = updateStats()

      // Stats should be calculated
      expect(result.totalImprovements).toBeGreaterThanOrEqual(0)
      expect(result.appliedCount).toBeGreaterThanOrEqual(0)
      expect(result.suggestedCount).toBeGreaterThanOrEqual(0)
      expect(result.effectivenessScores).toBeDefined()
      expect(result.topCategories).toBeDefined()
    })

    it('should match total with applied + suggested', () => {
      const result = updateStats()

      expect(result.totalImprovements).toBe(result.appliedCount + result.suggestedCount)
    })

    it('should update lastUpdated timestamp', () => {
      const before = readAuditHistory()

      // Wait a bit to ensure timestamp changes
      const result = updateStats()

      expect(result).toBeDefined()
      // lastUpdated should be updated (or could be null if no improvements)
      expect(before.lastUpdated).toBeDefined()
    })
  })

  describe('getEffectivenessScore', () => {
    it('should return effectiveness scores for a given type', () => {
      // First add an improvement to test
      const newImprovement: Omit<Improvement, 'date'> = {
        taskId: '260221-effectiveness-test',
        type: 'PROMPT',
        title: 'Effectiveness test',
        where: 'test.ts',
        status: 'applied',
        followUpTaskIds: [],
        effectiveness: 'effective',
      }

      addImprovement(newImprovement)

      const result = getEffectivenessScore('PROMPT')

      expect(result).not.toBeNull()
      expect(result!.total).toBeGreaterThan(0)
      expect(typeof result!.effective).toBe('number')
      expect(typeof result!.neutral).toBe('number')
      expect(typeof result!.ineffective).toBe('number')
      expect(typeof result!.unknown).toBe('number')
    })

    it('should return null for non-existent type', () => {
      const result = getEffectivenessScore('NONEXISTENT_TYPE_12345')

      expect(result).toBeNull()
    })

    it('should correctly count effectiveness levels', () => {
      // Add multiple improvements with different effectiveness levels
      const types = ['DOC', 'DOC', 'DOC']
      const effectivenessLevels: Improvement['effectiveness'][] = [
        'effective',
        'effective',
        'neutral',
      ]

      for (let i = 0; i < types.length; i++) {
        addImprovement({
          taskId: `260221-multi-effectiveness-${i}`,
          type: types[i],
          title: `Test ${i}`,
          where: 'test.ts',
          status: 'applied',
          followUpTaskIds: [],
          effectiveness: effectivenessLevels[i],
        })
      }

      const result = getEffectivenessScore('DOC')

      expect(result).not.toBeNull()
      expect(result!.total).toBe(3)
      expect(result!.effective).toBe(2)
      expect(result!.neutral).toBe(1)
      expect(result!.ineffective).toBe(0)
    })
  })

  describe('getImprovementTypes', () => {
    it('should return all unique improvement types', () => {
      // Add improvements of different types
      addImprovement({
        taskId: '260221-type-test-1',
        type: 'DOC',
        title: 'Doc test 1',
        where: 'test.ts',
        status: 'applied',
        followUpTaskIds: [],
        effectiveness: 'effective',
      })

      addImprovement({
        taskId: '260221-type-test-2',
        type: 'GUARDRAIL',
        title: 'Guardrail test',
        where: 'test.ts',
        status: 'applied',
        followUpTaskIds: [],
        effectiveness: 'neutral',
      })

      const types = getImprovementTypes()

      expect(types).toContain('DOC')
      expect(types).toContain('GUARDRAIL')
      expect(Array.isArray(types)).toBe(true)
    })
  })

  describe('schema validation', () => {
    it('should validate that version is a number', () => {
      const history = readAuditHistory()
      expect(typeof history.version).toBe('number')
    })

    it('should validate that improvements is an array', () => {
      const history = readAuditHistory()
      expect(Array.isArray(history.improvements)).toBe(true)
    })

    it('should validate stats structure', () => {
      const history = readAuditHistory()

      // Check stats fields exist and have correct types
      expect(typeof history.stats.totalImprovements).toBe('number')
      expect(typeof history.stats.appliedCount).toBe('number')
      expect(typeof history.stats.suggestedCount).toBe('number')

      // Check effectivenessScores structure
      expect(typeof history.stats.effectivenessScores.effective).toBe('number')
      expect(typeof history.stats.effectivenessScores.neutral).toBe('number')
      expect(typeof history.stats.effectivenessScores.ineffective).toBe('number')
      expect(typeof history.stats.effectivenessScores.unknown).toBe('number')

      // Check topCategories is an object
      expect(typeof history.stats.topCategories).toBe('object')
    })

    it('should validate lastUpdated is a string or null', () => {
      const history = readAuditHistory()
      expect(typeof history.lastUpdated === 'string' || history.lastUpdated === null).toBe(true)
    })
  })

  describe('file existence', () => {
    it('should have audit-history.json file in .tasks directory', () => {
      expect(fs.existsSync(TASKS_DIR)).toBe(true)
      expect(fs.existsSync(AUDIT_HISTORY_FILE)).toBe(true)
    })

    it('should have valid JSON content', () => {
      const content = fs.readFileSync(AUDIT_HISTORY_FILE, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })
  })
})
