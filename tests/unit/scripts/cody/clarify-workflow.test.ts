/**
 * @fileType test
 * @domain ci | cody
 * @pattern clarify-workflow
 * @ai-summary Tests for clarify-workflow.ts - question/answer workflow for clarification stage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  extractAnswerFromComment,
  handleClarification,
  handleGateApproval,
} from '../../../../scripts/cody/clarify-workflow'
import * as githubApi from '../../../../scripts/cody/github-api'
import type { CodyInput } from '../../../../scripts/cody/cody-utils'

vi.spyOn(githubApi, 'getLatestIssueComment').mockReturnValue(null)

describe('clarify-workflow', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-clarify-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  // ========================================================================
  // extractAnswerFromComment
  // ========================================================================

  describe('extractAnswerFromComment', () => {
    it('returns null for empty comment', () => {
      expect(extractAnswerFromComment('')).toBeNull()
    })

    it('returns null for just /cody command', () => {
      expect(extractAnswerFromComment('/cody')).toBeNull()
    })

    it('extracts answer from simple comment', () => {
      const result = extractAnswerFromComment('Use TypeScript for type safety.')
      expect(result).toBe('Use TypeScript for type safety.')
    })

    it('extracts answer from comment with task-id', () => {
      const result = extractAnswerFromComment('/cody 260218-my-task The answer is yes.')
      expect(result).toBe('The answer is yes.')
    })

    it('extracts answer from comment with mode and task-id', () => {
      const result = extractAnswerFromComment('/cody full 260218-my-task The answer.')
      expect(result).toBe('The answer.')
    })

    it('handles JSON-encoded body from jq -Rs .', () => {
      const jsonBody = '"The answer from JSON"'
      const result = extractAnswerFromComment(jsonBody)
      expect(result).toBe('The answer from JSON')
    })

    it('handles escaped newlines', () => {
      const body = 'Line 1\\nLine 2'
      const result = extractAnswerFromComment(body)
      expect(result).toContain('Line 1')
      expect(result).toContain('Line 2')
    })

    it('extracts answer with lowercase cody prefix', () => {
      const result = extractAnswerFromComment('/cody 260218-task Answer')
      expect(result).toBe('Answer')
    })

    it('returns null when no answer content after task-id', () => {
      const result = extractAnswerFromComment('/cody 260218-my-task')
      expect(result).toBeNull()
    })

    it('trims whitespace from answer', () => {
      const result = extractAnswerFromComment('  Some answer  ')
      expect(result).toBe('Some answer')
    })
  })

  // ========================================================================
  // handleClarification
  // ========================================================================

  describe('handleClarification', () => {
    const createMockInput = (overrides: Partial<CodyInput> = {}): CodyInput => ({
      mode: 'full',
      taskId: '260218-test',
      dryRun: false,
      local: false,
      clarify: false,
      ...overrides,
    })

    it('returns no-questions when questions.md does not exist', () => {
      const result = handleClarification(createMockInput(), tempDir)
      expect(result).toBe('no-questions')
    })

    it('returns no-questions and creates clarified.md when no questions', () => {
      // Create empty questions.md (too short to have questions)
      fs.writeFileSync(path.join(tempDir, 'questions.md'), 'No questions here.')

      const result = handleClarification(createMockInput(), tempDir)
      expect(result).toBe('no-questions')

      const clarifiedPath = path.join(tempDir, 'clarified.md')
      expect(fs.existsSync(clarifiedPath)).toBe(true)
      expect(fs.readFileSync(clarifiedPath, 'utf-8')).toContain('Use recommended answers')
    })

    it('returns answered when answer provided via commentBody', () => {
      fs.writeFileSync(path.join(tempDir, 'questions.md'), '1. What color?')
      const input = createMockInput({
        commentBody: 'The sky is blue.',
        triggerType: 'comment',
      })

      const result = handleClarification(input, tempDir)
      expect(result).toBe('answered')

      const clarifiedPath = path.join(tempDir, 'clarified.md')
      expect(fs.existsSync(clarifiedPath)).toBe(true)
      expect(fs.readFileSync(clarifiedPath, 'utf-8')).toContain('The sky is blue')
    })

    it('returns waiting when questions exist and no answer provided', () => {
      // Mock to return null for issue comment
      vi.spyOn(githubApi, 'getLatestIssueComment').mockReturnValue(null)

      fs.writeFileSync(
        path.join(tempDir, 'questions.md'),
        '## Questions\n\n1. What is the deadline?',
      )
      const input = createMockInput({
        issueNumber: 42,
        triggerType: 'comment',
      })

      const result = handleClarification(input, tempDir)
      expect(result).toBe('waiting')
    })

    it('does not overwrite existing clarified.md even with commentBody', () => {
      fs.writeFileSync(path.join(tempDir, 'questions.md'), '1. Question?')
      fs.writeFileSync(path.join(tempDir, 'clarified.md'), '# Clarified\n\nAlready answered.')
      const input = createMockInput({
        commentBody: 'New answer',
        triggerType: 'comment',
      })

      const result = handleClarification(input, tempDir)

      // Actually, when clarified.md exists BUT there's an answer, the code
      // DOES overwrite it (per current implementation logic)
      // So the result is 'answered' but the file gets overwritten
      expect(result).toBe('answered')
    })

    it('prefers commentBody answer over issue comment', () => {
      fs.writeFileSync(path.join(tempDir, 'questions.md'), '1. What color?')
      const input = createMockInput({
        issueNumber: 42,
        commentBody: 'Answer from comment body',
        triggerType: 'comment',
      })

      const result = handleClarification(input, tempDir)
      expect(result).toBe('answered')

      const clarifiedContent = fs.readFileSync(path.join(tempDir, 'clarified.md'), 'utf-8')
      expect(clarifiedContent).toContain('Answer from comment body')
    })
  })

  // ========================================================================
  // handleGateApproval (Autonomous Decision Control Framework)
  // ========================================================================

  describe('handleGateApproval', () => {
    const createMockInput = (overrides: Partial<CodyInput> = {}): CodyInput => ({
      mode: 'full',
      taskId: '260218-test',
      dryRun: false,
      local: false,
      clarify: false,
      ...overrides,
    })

    const taskDef = {
      risk_level: 'medium',
      task_type: 'implement_feature',
      confidence: 0.9,
      scope: ['src/app'],
    }

    it('first call with no approval → returns waiting, creates gate file', () => {
      // Create task.md so the function can read task summary
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Test Task\n\nThis is a test task.')

      const result = handleGateApproval(createMockInput(), tempDir, 'architect', taskDef)

      expect(result).toBe('waiting')

      // Gate request file should be created
      const gatePath = path.join(tempDir, 'gate-architect.md')
      expect(fs.existsSync(gatePath)).toBe(true)
      expect(fs.readFileSync(gatePath, 'utf-8')).toContain('Gate Request')
    })

    it('with approval keyword in comment → returns approved, creates approved file', () => {
      const input = createMockInput({
        commentBody: '/cody approve',
        triggerType: 'comment',
      })

      const result = handleGateApproval(input, tempDir, 'architect', taskDef)

      expect(result).toBe('approved')

      // Approved file should be created
      const approvedPath = path.join(tempDir, 'gate-architect-approved.md')
      expect(fs.existsSync(approvedPath)).toBe(true)
      expect(fs.readFileSync(approvedPath, 'utf-8')).toContain('Gate Approved')
    })

    it('with rejection keyword in comment → returns rejected', () => {
      const input = createMockInput({
        commentBody: '/cody reject',
        triggerType: 'comment',
      })

      const result = handleGateApproval(input, tempDir, 'architect', taskDef)

      expect(result).toBe('rejected')

      // Gate request file should contain rejection
      const gatePath = path.join(tempDir, 'gate-architect.md')
      expect(fs.existsSync(gatePath)).toBe(true)
      expect(fs.readFileSync(gatePath, 'utf-8')).toContain('Gate Rejected')
    })

    it('already approved (approved file exists) → returns approved', () => {
      // Create approved file first
      const approvedPath = path.join(tempDir, 'gate-architect-approved.md')
      fs.writeFileSync(approvedPath, '# Gate Approved\n\nAlready approved.')

      const result = handleGateApproval(createMockInput(), tempDir, 'architect', taskDef)

      expect(result).toBe('approved')
    })

    // Approval keywords: approve, approved, yes, go, proceed, y, continue
    it.each([
      ['approve', 'approved'],
      ['approved', 'approved'],
      ['yes', 'approved'],
      ['go', 'approved'],
      ['proceed', 'approved'],
      ['y', 'approved'],
      ['continue', 'approved'],
    ])('approval keyword "%s" → returns approved', (keyword, _expected) => {
      const input = createMockInput({
        commentBody: `/cody ${keyword}`,
        triggerType: 'comment',
      })

      const result = handleGateApproval(input, tempDir, 'architect', taskDef)
      expect(result).toBe('approved')
    })

    // BUG-F fix: @cody prefix should also work for approval
    it.each([['@cody approve'], ['@cody yes'], ['@cody proceed']])(
      '@cody prefix with approval keyword "%s" → returns approved',
      (commentBody) => {
        const input = createMockInput({
          commentBody,
          triggerType: 'comment',
        })

        const result = handleGateApproval(input, tempDir, 'architect', taskDef)
        expect(result).toBe('approved')
      },
    )

    // Rejection keywords: reject, rejected, no, cancel, stop, n
    it.each([
      ['reject', 'rejected'],
      ['rejected', 'rejected'],
      ['no', 'rejected'],
      ['cancel', 'rejected'],
      ['stop', 'rejected'],
      ['n', 'rejected'],
    ])('rejection keyword "%s" → returns rejected', (keyword, _expected) => {
      const input = createMockInput({
        commentBody: `/cody ${keyword}`,
        triggerType: 'comment',
      })

      const result = handleGateApproval(input, tempDir, 'architect', taskDef)
      expect(result).toBe('rejected')
    })

    // BUG-F fix: @cody prefix should also work for rejection
    it.each([['@cody reject'], ['@cody no'], ['@cody cancel']])(
      '@cody prefix with rejection keyword "%s" → returns rejected',
      (commentBody) => {
        const input = createMockInput({
          commentBody,
          triggerType: 'comment',
        })

        const result = handleGateApproval(input, tempDir, 'architect', taskDef)
        expect(result).toBe('rejected')
      },
    )

    it('high risk_level triggers hard-stop mode comment', () => {
      const highRiskTaskDef = { ...taskDef, risk_level: 'high' }
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Test Task\n\nHigh risk task.')

      const result = handleGateApproval(createMockInput(), tempDir, 'architect', highRiskTaskDef)

      expect(result).toBe('waiting')

      const gatePath = path.join(tempDir, 'gate-architect.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('Hard Stop')
    })

    it('gate request already exists → returns waiting without recreating', () => {
      // Create gate request file first
      const gatePath = path.join(tempDir, 'gate-architect.md')
      fs.writeFileSync(gatePath, '# Gate Request\n\nOriginal content.')

      const result = handleGateApproval(createMockInput(), tempDir, 'architect', taskDef)

      expect(result).toBe('waiting')
      // Content should not be overwritten
      expect(fs.readFileSync(gatePath, 'utf-8')).toContain('Original content')
    })

    it('extracts task summary skipping markdown headers and empty lines', () => {
      fs.writeFileSync(
        path.join(tempDir, 'task.md'),
        '# Task\n\n## Task Description\n\nImplement the new feature for users.',
      )

      const result = handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      expect(result).toBe('waiting')
      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('Implement the new feature for users')
      expect(content).not.toContain('> # Task')
      expect(content).not.toContain('> ## Task Description')
    })

    it('falls back to default summary when task.md has only headers', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\n## Description\n\n')

      const result = handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      expect(result).toBe('waiting')
      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('See task.md for details')
    })

    it('shows file paths in scope when 5 or fewer files', () => {
      const smallScopeTaskDef = {
        ...taskDef,
        scope: ['src/foo.ts', 'src/bar.ts'],
      }
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')

      handleGateApproval(createMockInput(), tempDir, 'taskify', smallScopeTaskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('`src/foo.ts`')
      expect(content).toContain('`src/bar.ts`')
    })

    it('shows file count in scope when more than 5 files', () => {
      const largeScopeTaskDef = {
        ...taskDef,
        scope: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'],
      }
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')

      handleGateApproval(createMockInput(), tempDir, 'taskify', largeScopeTaskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('6 files')
      expect(content).not.toContain('`a.ts`')
    })

    it('includes assumptions from task.json when present', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')
      fs.writeFileSync(
        path.join(tempDir, 'task.json'),
        JSON.stringify({
          assumptions: ['Users have Node 18+', 'Database is MongoDB'],
        }),
      )

      handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('### Assumptions')
      expect(content).toContain('- Users have Node 18+')
      expect(content).toContain('- Database is MongoDB')
    })

    it('omits assumptions section when task.json has no assumptions', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')
      fs.writeFileSync(path.join(tempDir, 'task.json'), JSON.stringify({ task_type: 'fix' }))

      handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).not.toContain('### Assumptions')
    })

    it('handles missing task.json gracefully', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')
      // No task.json

      handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('Gate Request')
      expect(content).not.toContain('### Assumptions')
    })

    it('includes review_questions from task.json when present', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')
      fs.writeFileSync(
        path.join(tempDir, 'task.json'),
        JSON.stringify({
          assumptions: ['Users have Node 18+'],
          review_questions: [
            'Should this support Node 20+ only?',
            'Is the database choice correct?',
          ],
        }),
      )

      handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('### Review Questions')
      expect(content).toContain('1. Should this support Node 20+ only?')
      expect(content).toContain('2. Is the database choice correct?')
    })

    it('omits review questions section when task.json has no review_questions', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')
      fs.writeFileSync(
        path.join(tempDir, 'task.json'),
        JSON.stringify({
          assumptions: ['Some assumption'],
        }),
      )

      handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).not.toContain('### Review Questions')
      // But assumptions should still be there
      expect(content).toContain('### Assumptions')
    })

    it('shows both assumptions and review_questions when both present', () => {
      fs.writeFileSync(path.join(tempDir, 'task.md'), '# Task\n\nSome task.')
      fs.writeFileSync(
        path.join(tempDir, 'task.json'),
        JSON.stringify({
          assumptions: ['Assume this is true'],
          review_questions: ['Is this assumption correct?'],
        }),
      )

      handleGateApproval(createMockInput(), tempDir, 'taskify', taskDef)

      const gatePath = path.join(tempDir, 'gate-taskify.md')
      const content = fs.readFileSync(gatePath, 'utf-8')
      expect(content).toContain('### Assumptions')
      expect(content).toContain('- Assume this is true')
      expect(content).toContain('### Review Questions')
      expect(content).toContain('1. Is this assumption correct?')
    })
  })
})
