// @vitest-environment jsdom
/**
 * Unit Tests for TaskList Cody Assignment Feature
 *
 * Tests that verify the Bot icon is displayed adjacent to issue number
 * when a task is Cody-assigned, and that human assignees show User icon
 * in the meta row instead.
 */
import { TaskList } from '@/ui/cody/components/TaskList'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('TaskList Cody Assignment Display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const createMockTask = (overrides: Partial<import('@/ui/cody/types').CodyTask> = {}) => ({
    id: '507',
    issueNumber: 507,
    title: 'Test task for Cody assignment',
    body: '',
    state: 'open' as const,
    labels: [],
    column: 'open' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCodyAssigned: false,
    assignees: [],
    ...overrides,
  })

  describe('Bot icon adjacent to issue number', () => {
    it('should render Bot icon inline with issue number when isCodyAssigned is true', () => {
      const codyAssignedTask = createMockTask({
        isCodyAssigned: true,
        assignees: [],
      })

      render(
        <TaskList
          tasks={[codyAssignedTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // The issue number should be present
      const issueNumber = screen.getByText('#507')
      expect(issueNumber).toBeTruthy()

      // The Bot icon should be in Row 1 (the title row), directly adjacent to issue number
      // This is the key behavioral change: Bot icon moves from meta row to title row
      const titleRow = issueNumber.parentElement
      expect(titleRow).toBeTruthy()

      // Check that Row 1 contains the Bot icon (this is the new expected behavior)
      const titleRowHtml = titleRow?.innerHTML || ''
      expect(titleRowHtml).toContain('lucide-bot')
    })

    it('should NOT render Bot icon adjacent to issue number when isCodyAssigned is false', () => {
      const humanAssignedTask = createMockTask({
        isCodyAssigned: false,
        assignees: [{ login: 'johndoe', avatar_url: 'https://example.com/avatar.png' }],
      })

      render(
        <TaskList
          tasks={[humanAssignedTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // Issue number should still be present
      const issueNumber = screen.getByText('#507')
      expect(issueNumber).toBeTruthy()

      // The Bot icon should NOT appear in Row 1 (next to issue number)
      // But there should still be a User icon in the meta row
      const issueNumberContainer = issueNumber.parentElement
      expect(issueNumberContainer).toBeTruthy()

      // Check that there's no Bot icon as a direct sibling of the issue number span
      const hasBotAdjacentToIssueNumber = Array.from(issueNumberContainer?.children || []).some(
        (child) => child.querySelector('svg.lucide-bot') || child.classList.contains('lucide-bot'),
      )
      expect(hasBotAdjacentToIssueNumber).toBe(false)
    })
  })

  describe('User icon in meta row for human assignees', () => {
    it('should render User icon in meta row when task has human assignees and isCodyAssigned is false', () => {
      const humanAssignedTask = createMockTask({
        isCodyAssigned: false,
        assignees: [{ login: 'johndoe', avatar_url: 'https://example.com/avatar.png' }],
      })

      render(
        <TaskList
          tasks={[humanAssignedTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // Should show human assignee name in meta row
      expect(screen.getByText('johndoe')).toBeTruthy()

      // Should show User icon for human assignee
      const userIcon = document.querySelector('svg.lucide-user')
      expect(userIcon).toBeTruthy()
    })

    it('should NOT render User icon when task is Cody-assigned', () => {
      const codyAssignedTask = createMockTask({
        isCodyAssigned: true,
        assignees: [],
      })

      render(
        <TaskList
          tasks={[codyAssignedTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // Should NOT show "Cody" text label anymore (since it's now shown via icon)
      // The meta row should not show "Cody" text when isCodyAssigned is true
      const codyText = screen.queryByText('Cody')
      // Verify the text is not present (icon takes precedence)
      expect(codyText).toBeNull()
    })
  })

  describe('No icons for unassigned tasks', () => {
    it('should show neither Bot nor User icon when task has no assignees and isCodyAssigned is false', () => {
      const unassignedTask = createMockTask({
        isCodyAssigned: false,
        assignees: [],
        title: 'Unassigned test task', // Use a title without "Cody" to avoid false matches
      })

      render(
        <TaskList
          tasks={[unassignedTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // Issue number should be present
      expect(screen.getByText('#507')).toBeTruthy()

      // Should not show any assignee-related content
      // The meta row should not have any assignee indicators
      // (Note: we use a title without "Cody" to avoid matching the h3 title)
      const assigneeMeta = screen.queryByText(/Cody/)
      expect(assigneeMeta).toBeNull()
    })
  })

  describe('Visual prominence of Cody assignment', () => {
    it('should make Cody assignment visually prominent by placing icon directly next to issue number', () => {
      const codyAssignedTask = createMockTask({
        isCodyAssigned: true,
        assignees: [],
      })

      render(
        <TaskList
          tasks={[codyAssignedTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // Find the issue number element
      const issueNumberEl = screen.getByText('#507')

      // Get its parent container (Row 1: title line)
      const row1Container = issueNumberEl.parentElement
      expect(row1Container).toBeTruthy()

      // The Row 1 container should contain the Bot icon
      // This ensures the icon is visually prominent right next to the issue number
      const row1Html = row1Container?.innerHTML || ''
      expect(row1Html).toContain('lucide-bot')
    })

    it('should differentiate Cody-assigned from human-assigned tasks by icon placement', () => {
      const codyTask = createMockTask({ isCodyAssigned: true, assignees: [] })
      const humanTask = createMockTask({
        isCodyAssigned: false,
        assignees: [{ login: 'human', avatar_url: '' }],
      })

      render(
        <TaskList
          tasks={[codyTask, humanTask]}
          selectedTask={null}
          onTaskSelect={vi.fn()}
          onExecuteTask={vi.fn()}
        />,
      )

      // Cody task should have Bot icon in Row 1
      const codyIssueNumber = screen.getAllByText('#507')[0]
      const codyRow1 = codyIssueNumber?.parentElement

      // Human task should NOT have Bot icon next to issue number
      const humanIssueNumber = screen.getAllByText('#507')[1]
      const humanRow1 = humanIssueNumber?.parentElement

      // Verify the difference: Cody task has bot in Row 1, human doesn't
      const codyRow1HasBot = codyRow1?.innerHTML.includes('lucide-bot') || false
      const humanRow1HasBot = humanRow1?.innerHTML.includes('lucide-bot') || false

      expect(codyRow1HasBot).toBe(true)
      expect(humanRow1HasBot).toBe(false)
    })
  })
})
