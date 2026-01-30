/**
 * Unit Tests for Task Registry
 */
import { registerTask, taskRegistry } from '@/server/payload/jobs/task-registry'
import { beforeEach, describe, expect, it } from 'vitest'

describe('TaskRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    const map = (taskRegistry as unknown as { tasks: Map<string, unknown> }).tasks
    map.clear()
  })

  describe('register()', () => {
    it('should register a task', () => {
      const handler = (() => {}) as any
      registerTask('test-task', handler, 'Test description')

      expect(taskRegistry.has('test-task')).toBe(true)
    })

    it('should overwrite existing task with same slug', () => {
      const handler1 = (() => {}) as any
      const handler2 = (() => {}) as any
      registerTask('test-task', handler1)
      registerTask('test-task', handler2)

      const task = taskRegistry.get('test-task')
      expect(task?.handler).toBe(handler2)
    })

    it('should store description', () => {
      registerTask('my-task', (() => {}) as any, 'My task description')

      const task = taskRegistry.get('my-task')
      expect(task?.description).toBe('My task description')
    })
  })

  describe('get()', () => {
    it('should return undefined for non-existent task', () => {
      expect(taskRegistry.get('non-existent')).toBeUndefined()
    })

    it('should return task with handler and description', () => {
      const handler = (() => {}) as any
      registerTask('test-task', handler, 'Test description')

      const task = taskRegistry.get('test-task')
      expect(task?.handler).toBe(handler)
      expect(task?.description).toBe('Test description')
    })
  })

  describe('has()', () => {
    it('should return false for non-existent task', () => {
      expect(taskRegistry.has('non-existent')).toBe(false)
    })

    it('should return true for registered task', () => {
      registerTask('existing-task', (() => {}) as any)
      expect(taskRegistry.has('existing-task')).toBe(true)
    })
  })

  describe('list()', () => {
    it('should return empty array when no tasks registered', () => {
      expect(taskRegistry.list()).toEqual([])
    })

    it('should return all registered task slugs', () => {
      registerTask('task-1', (() => {}) as any)
      registerTask('task-2', (() => {}) as any)
      registerTask('task-3', (() => {}) as any)

      const slugs = taskRegistry.list()
      expect(slugs).toContain('task-1')
      expect(slugs).toContain('task-2')
      expect(slugs).toContain('task-3')
    })
  })

  describe('describe()', () => {
    it('should return exists: false for non-existent task', () => {
      const result = taskRegistry.describe('non-existent')
      expect(result.exists).toBe(false)
      expect(result.description).toBeUndefined()
    })

    it('should return exists: true and description for registered task', () => {
      registerTask('test-task', (() => {}) as any, 'My task')

      const result = taskRegistry.describe('test-task')
      expect(result.exists).toBe(true)
      expect(result.description).toBe('My task')
    })
  })
})
